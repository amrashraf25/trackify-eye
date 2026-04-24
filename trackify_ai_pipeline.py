"""
╔══════════════════════════════════════════════════════════════════════╗
║      TRACKIFY — COMPLETE MULTI-MODEL AI PIPELINE v4                 ║
║  Modular · Production-ready · Tracking + Counting + Attendance      ║
╚══════════════════════════════════════════════════════════════════════╝

Architecture (upgraded):
  PersonDetector (YOLO)     → detect every person in frame
  PersonTracker (ByteTrack) → assign stable IDs, survive occlusions
  FaceRecognitionDetector   → InsightFace buffalo_l per tracked person
  ClassroomCounter          → vote-stabilised names + attendance logic
  BehaviorDetectors         → Sleeping/Cheating/Phone/Fighting/Talking
  AlertManager              → severity scoring + event log
  Flask API                 → MJPEG stream + SSE + REST endpoints

New pipeline order:
  Camera
    → YOLO person detection
    → PersonTracker (stable IDs)
    → InsightFace recognition per track
    → RecognitionVoter (stabilise flickering names)
    → AttendanceBuffer (confirm after 3 s)
    → MediaPipe behaviour analysis per face
    → AlertManager

Run:
  python trackify_ai_pipeline.py
"""

import cv2
import numpy as np
import os, sys, time, json, threading
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import requests

# ── New tracking / counting modules ──────────────────────────────────
from tracking import PersonTracker, match_faces_to_tracks
from counting import ClassroomCounter

# ── Backend event dispatcher ──────────────────────────────────────────
from event_dispatcher import get_dispatcher
_dispatcher = get_dispatcher()

# ── Student filter + identity binder ─────────────────────────────────
from student_filter import StudentFilter
from identity_binder import IdentityBinder

# ════════════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ════════════════════════════════════════════════════════════════════════

class Config:
    # Local API (database)
    API_URL  = "http://localhost:3001"
    API_KEY  = "local-anon-key"

    # Camera
    CAMERA_INDEX  = 0
    FRAME_W       = 640
    FRAME_H       = 480
    CAMERA_FPS    = 30
    WARMUP_FRAMES = 20

    # Flask
    FLASK_HOST = "0.0.0.0"
    FLASK_PORT = 5000

    # Face recognition threshold (0.0–1.0)
    FACE_THRESHOLD = 0.28

    # Model paths — swap to your trained model after fine-tuning
    # Set to None to use default YOLOv8n (COCO)
    CLASSROOM_MODEL = None  # e.g. "datasets/runs/detect/trackify_v1/weights/best.pt"
    POSE_MODEL      = None  # e.g. "yolov8n-pose.pt" (auto-downloaded)

    # Behavior frame thresholds (how many consecutive frames before flagging)
    SLEEPING_FRAMES  = 15
    DROWSY_FRAMES    = 8
    CHEATING_FRAMES  = 20
    FIGHTING_FRAMES  = 3

    # ── Tracking (PersonTracker) ──────────────────────────────────────
    TRACK_IOU_HIGH  = 0.5   # Stage-1 match threshold (active tracks)
    TRACK_IOU_LOW   = 0.3   # Stage-2 match threshold (lost tracks)
    TRACK_MAX_AGE   = 30    # frames before deleting an unmatched track
    TRACK_MIN_HITS  = 3     # frames before confirming a new track

    # ── Attendance (ClassroomCounter) ─────────────────────────────────
    ATTEND_CONFIRM_SEC  = 3.0   # seconds of continuous detection → present
    ATTEND_GAP_TOL      = 1.5   # seconds gap allowed without resetting streak
    VOTE_WINDOW         = 10    # recognition vote sliding-window size
    VOTE_THRESHOLD      = 0.6   # fraction of window that must agree on a name
    MIN_RECOG_CONF      = 0.25  # cosine similarity below this → Unknown

    # Log events to file
    LOG_EVENTS = True
    LOG_FILE   = Path("trackify_events.jsonl")

    HEADERS = {"apikey": API_KEY, "Authorization": f"Bearer {API_KEY}"}


# ════════════════════════════════════════════════════════════════════════
#  OPTIONAL IMPORTS  (graceful fallback if not installed)
# ════════════════════════════════════════════════════════════════════════

def _try_import(name, pip_name=None):
    try:
        import importlib
        mod = importlib.import_module(name)
        print(f"  ✓ {name}")
        return mod
    except ImportError:
        print(f"  ✗ {name}  →  pip install {pip_name or name}")
        return None

print("Loading AI modules...")
_flask        = _try_import("flask")
_insightface  = _try_import("insightface")
_mediapipe    = _try_import("mediapipe")
_ultralytics  = _try_import("ultralytics")
_sklearn      = _try_import("sklearn.metrics.pairwise", "scikit-learn")
_PIL          = _try_import("PIL", "Pillow")

if _flask:
    from flask import Flask, Response, jsonify, request

# ════════════════════════════════════════════════════════════════════════
#  GLOBAL SHARED STATE
# ════════════════════════════════════════════════════════════════════════

_state = {
    "frame":    None,
    "active":   False,
    "status":   {"faces": [], "face_count": 0, "fps": 0, "connected": True},
    "ai":       {"faces": [], "face_count": 0, "rects": []},
    "alerts":   {"fighting": 0, "cheating": 0, "sleeping": 0,
                 "phone": 0, "talking": 0, "drowsy": 0},
    "session_start": time.time(),
    "events":   deque(maxlen=200),   # recent behavior events
    # ── Counting / Attendance ──────────────────────────────────────────
    "counting": {
        "present_confirmed": [],
        "present_in_frame":  [],
        "absent":            [],
        "unknown_in_frame":  0,
        "total_in_frame":    0,
        "total_registered":  0,
        "attendance_rate":   0.0,
        "newly_confirmed":   [],
    },
}

_locks = {k: threading.Lock() for k in
          ["frame", "active", "status", "ai", "alerts", "events", "counting"]}


def _get(key):
    with _locks[key]:
        v = _state[key]
        return dict(v) if isinstance(v, dict) else v


def _set(key, value):
    with _locks[key]:
        _state[key] = value


def _inc_alert(behavior_key):
    with _locks["alerts"]:
        k = behavior_key.lower()
        if k in _state["alerts"]:
            _state["alerts"][k] += 1


def _log_event(name, behavior, severity, student_code=""):
    ev = {
        "ts": datetime.now().isoformat(),
        "name": name,
        "behavior": behavior,
        "severity": severity,
        "student_code": student_code,
    }
    with _locks["events"]:
        _state["events"].appendleft(ev)
    if Config.LOG_EVENTS:
        try:
            with open(Config.LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(ev) + "\n")
        except Exception:
            pass


# ════════════════════════════════════════════════════════════════════════
#  DETECTOR 1 — Face Recognition
# ════════════════════════════════════════════════════════════════════════

class FaceRecognitionDetector:
    def __init__(self):
        self.app = None
        self.embeddings = np.array([])
        self.names, self.codes, self.ids = [], [], []

        if not _insightface:
            return
        try:
            from insightface.app import FaceAnalysis
            self.app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            self.app.prepare(ctx_id=0, det_size=(320, 320))
            print("  ✓ InsightFace initialized")
        except Exception as e:
            print(f"  ✗ InsightFace init failed: {e}")

    def load_students(self):
        """Fetch students from local API and extract face embeddings."""
        print("\nLoading students from API...")
        try:
            r = requests.get(
                f"{Config.API_URL}/rest/v1/students",
                params={"select": "id,student_code,full_name,avatar_url",
                        "status": "eq.active", "avatar_url": "not.is.null"},
                headers=Config.HEADERS, timeout=15,
            )
            r.raise_for_status()
            students = r.json()
        except Exception as e:
            print(f"  ✗ Could not fetch students: {e}")
            return

        embs, names, codes, ids = [], [], [], []
        for s in students:
            name = s.get("full_name", "").strip()
            url  = s.get("avatar_url", "")
            if not name or not url:
                continue
            emb = self._embed_from_url(url, name)
            if emb is not None:
                embs.append(emb)
                names.append(name)
                codes.append(s.get("student_code", ""))
                ids.append(s.get("id", ""))
                print(f"  ✓ {name}")
            else:
                print(f"  ✗ {name}: no face found in photo")

        if embs:
            self.embeddings = np.array(embs)
            self.names, self.codes, self.ids = names, codes, ids
            print(f"Loaded {len(names)}/{len(students)} students\n")

    def _embed_from_url(self, url, name):
        """Download image and extract face embedding."""
        if self.app is None:
            return None
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            arr = np.frombuffer(resp.content, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

            if img is None and _PIL:
                from PIL import Image
                import io
                pil = Image.open(io.BytesIO(resp.content)).convert("RGB")
                img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

            if img is None:
                return None

            # Try original → upscaled → rotations
            for attempt in [img, cv2.resize(img, (640, 640)),
                            cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE),
                            cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)]:
                e = self._get_embedding(attempt)
                if e is not None:
                    return e
        except Exception:
            pass
        return None

    def _get_embedding(self, img):
        try:
            faces = self.app.get(img)
            if not faces:
                return None
            emb = faces[0].embedding
            return emb / np.linalg.norm(emb)
        except Exception:
            return None

    def recognize(self, frame, rect):
        """Match a face region against loaded students."""
        if self.app is None or len(self.embeddings) == 0:
            return "Unknown", 0.0, "", ""
        x1, y1, x2, y2 = rect
        try:
            roi = frame[y1:y2, x1:x2]
            if roi.size == 0:
                return "Unknown", 0.0, "", ""
            faces = self.app.get(roi)
            if not faces:
                return "Unknown", 0.0, "", ""
            emb = faces[0].embedding
            emb = emb / np.linalg.norm(emb)

            from sklearn.metrics.pairwise import cosine_similarity
            sims = cosine_similarity(self.embeddings, emb.reshape(1, -1)).flatten()
            idx  = int(np.argmax(sims))
            sim  = float(sims[idx])

            if sim > Config.FACE_THRESHOLD:
                return self.names[idx], sim, self.codes[idx], self.ids[idx]
        except Exception:
            pass
        return "Unknown", 0.0, "", ""


# ════════════════════════════════════════════════════════════════════════
#  DETECTOR 2 — Sleeping + Drowsy  (MediaPipe)
# ════════════════════════════════════════════════════════════════════════

class SleepingDetector:
    EAR_THRESHOLD  = 0.012   # eye aspect ratio
    PITCH_THRESHOLD = -0.20  # head drooping

    def __init__(self):
        self._eye_frames = defaultdict(int)

    def detect(self, person_id, landmarks):
        """Returns 'Sleeping', 'Drowsy', or None."""
        if landmarks is None:
            return None

        eyes_closed = self._eyes_closed(landmarks)
        head_drop   = self._head_drooping(landmarks)

        if eyes_closed or head_drop:
            self._eye_frames[person_id] += 1
        else:
            self._eye_frames[person_id] = max(0, self._eye_frames[person_id] - 1)

        if self._eye_frames[person_id] >= Config.SLEEPING_FRAMES:
            return "Sleeping"
        if self._eye_frames[person_id] >= Config.DROWSY_FRAMES:
            return "Drowsy"
        return None

    def _eyes_closed(self, lm):
        # Eye aspect ratio using MediaPipe landmarks
        left_top  = lm.landmark[159].y
        left_bot  = lm.landmark[145].y
        right_top = lm.landmark[386].y
        right_bot = lm.landmark[374].y
        left_ear  = abs(left_bot  - left_top)
        right_ear = abs(right_bot - right_top)
        return left_ear < self.EAR_THRESHOLD and right_ear < self.EAR_THRESHOLD

    def _head_drooping(self, lm):
        # Chin closer to nose than normal → head pitched forward
        forehead = lm.landmark[10]
        nose     = lm.landmark[1]
        chin     = lm.landmark[152]
        face_h = abs(chin.y - forehead.y)
        if face_h < 0.01:
            return False
        return (chin.y - nose.y) / face_h < self.PITCH_THRESHOLD


# ════════════════════════════════════════════════════════════════════════
#  DETECTOR 3 — Cheating  (head pose + gaze duration)
# ════════════════════════════════════════════════════════════════════════

class CheatingDetector:
    YAW_THRESHOLD   = 22.0  # degrees — head turned sideways
    PITCH_THRESHOLD = 25.0  # degrees — head looking down (at phone/notes)

    # 3D face model reference points
    _FACE_3D = np.array([
        [0.0,    0.0,   0.0  ],   # Nose tip
        [0.0, -330.0, -65.0 ],   # Chin
        [-225.0, 170.0,-135.0],  # Left eye outer
        [225.0,  170.0,-135.0],  # Right eye outer
        [-150.0,-150.0,-125.0],  # Left mouth
        [150.0, -150.0,-125.0],  # Right mouth
    ], dtype=np.float64)

    _LM_IDX = [1, 152, 263, 33, 287, 57]  # landmark indices

    def __init__(self):
        self._frames = defaultdict(int)

    def detect(self, person_id, landmarks, frame_w, frame_h):
        """Returns 'Cheating' or None."""
        if landmarks is None:
            return None

        angles = self._head_pose(landmarks, frame_w, frame_h)
        if angles is None:
            return None

        pitch, yaw, _ = angles
        suspicious = abs(yaw) > self.YAW_THRESHOLD or pitch > self.PITCH_THRESHOLD

        if suspicious:
            self._frames[person_id] += 1
        else:
            self._frames[person_id] = max(0, self._frames[person_id] - 2)

        return "Cheating" if self._frames[person_id] >= Config.CHEATING_FRAMES else None

    def get_angles(self, person_id, landmarks, frame_w, frame_h):
        """Public method for drawing head direction line."""
        if landmarks is None:
            return None
        return self._head_pose(landmarks, frame_w, frame_h)

    def _head_pose(self, lm, fw, fh):
        try:
            pts_2d = np.array(
                [(lm.landmark[i].x * fw, lm.landmark[i].y * fh) for i in self._LM_IDX],
                dtype=np.float64
            )
            focal  = fw
            cam    = np.array([[focal, 0, fw/2], [0, focal, fh/2], [0, 0, 1]], dtype=np.float64)
            dist   = np.zeros((4, 1))
            ok, rvec, tvec = cv2.solvePnP(self._FACE_3D, pts_2d, cam, dist,
                                           flags=cv2.SOLVEPNP_ITERATIVE)
            if not ok:
                return None
            rmat, _ = cv2.Rodrigues(rvec)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
            return float(angles[0]) * 360, float(angles[1]) * 360, float(angles[2]) * 360
        except Exception:
            return None


# ════════════════════════════════════════════════════════════════════════
#  DETECTOR 4 — Phone / Object  (YOLOv8)
# ════════════════════════════════════════════════════════════════════════

class ObjectDetector:
    PHONE_LABELS   = {"cell phone", "phone", "mobile phone", "smartphone"}
    FOOD_LABELS    = {"apple","banana","sandwich","orange","pizza","donut","cake","hot dog","carrot","broccoli"}
    DRINK_LABELS   = {"bottle","cup","wine glass","beer glass"}

    def __init__(self):
        self.model = None
        if not _ultralytics:
            return
        try:
            from ultralytics import YOLO
            model_path = Config.CLASSROOM_MODEL or "yolov8n.pt"
            self.model = YOLO(model_path)
            print(f"  ✓ Object detector loaded ({model_path})")
        except Exception as e:
            print(f"  ✗ YOLO init failed: {e}")

    def detect(self, frame):
        """Returns dict with lists: phones, food, drink, persons (with bboxes)."""
        result = {"phones": [], "food": [], "drink": [], "persons": []}
        if self.model is None:
            return result
        try:
            small = cv2.resize(frame, (640, 480))
            sx = frame.shape[1] / 640
            sy = frame.shape[0] / 480
            preds = self.model.predict(small, verbose=False, conf=0.3, imgsz=320)[0]
            for box in preds.boxes:
                label = self.model.names[int(box.cls[0])].lower()
                x1,y1,x2,y2 = map(int, box.xyxy[0])
                bbox = (int(x1*sx), int(y1*sy), int(x2*sx), int(y2*sy))
                if label in self.PHONE_LABELS or "phone" in label:
                    result["phones"].append(bbox)
                elif label in self.FOOD_LABELS:
                    result["food"].append(bbox)
                elif label in self.DRINK_LABELS:
                    result["drink"].append(bbox)
                elif label == "person":
                    result["persons"].append(bbox)
        except Exception:
            pass
        return result


# ════════════════════════════════════════════════════════════════════════
#  DETECTOR 5 — Fighting  (pose skeleton + motion analysis)
# ════════════════════════════════════════════════════════════════════════

class FightingDetector:
    """
    Strategy (no video model needed):
    1. YOLOv8-pose detects 17 keypoints per person
    2. Track wrist/elbow velocity between frames (fast movement = strike)
    3. Check person bounding box overlap (close bodies = possible fight)
    4. Require N consecutive suspicious frames before flagging
    """

    # COCO keypoint indices
    KP_LEFT_WRIST   = 9
    KP_RIGHT_WRIST  = 10
    KP_LEFT_ELBOW   = 7
    KP_RIGHT_ELBOW  = 8
    KP_LEFT_SHOULDER  = 5
    KP_RIGHT_SHOULDER = 6

    VELOCITY_THRESHOLD   = 40    # pixels/frame — fast wrist movement
    OVERLAP_THRESHOLD    = 0.25  # IoU between person boxes
    ARM_EXTEND_THRESHOLD = 160   # degrees — arm nearly straight

    def __init__(self):
        self.pose_model = None
        self._prev_kps  = {}          # person_id → keypoints
        self._alert_frames = 0

        if not _ultralytics:
            return
        try:
            from ultralytics import YOLO
            model_path = Config.POSE_MODEL or "yolov8n-pose.pt"
            self.pose_model = YOLO(model_path)
            print(f"  ✓ Pose detector loaded ({model_path})")
        except Exception as e:
            print(f"  ✗ Pose model failed: {e}")
            # Fallback: use bbox overlap only
            print("    → Falling back to bounding box overlap detection")

    def detect(self, frame, person_boxes):
        """Returns True if fighting is suspected."""
        if self.pose_model:
            return self._pose_based(frame, person_boxes)
        return self._overlap_based(person_boxes)

    def _pose_based(self, frame, person_boxes):
        """Full pose skeleton analysis."""
        suspicious = False
        try:
            small = cv2.resize(frame, (640, 480))
            sx = frame.shape[1] / 640
            sy = frame.shape[0] / 480
            results = self.pose_model.predict(small, verbose=False, conf=0.3)[0]

            if results.keypoints is None or len(results.keypoints.xy) < 2:
                # Need at least 2 people
                self._alert_frames = max(0, self._alert_frames - 1)
                return self._alert_frames >= Config.FIGHTING_FRAMES

            for i, kps in enumerate(results.keypoints.xy):
                kps_full = [(int(x*sx), int(y*sy)) for x, y in kps.tolist()]
                prev = self._prev_kps.get(i, kps_full)

                # Wrist velocity
                for kp_idx in [self.KP_LEFT_WRIST, self.KP_RIGHT_WRIST]:
                    if kp_idx < len(kps_full) and kp_idx < len(prev):
                        dx = kps_full[kp_idx][0] - prev[kp_idx][0]
                        dy = kps_full[kp_idx][1] - prev[kp_idx][1]
                        velocity = (dx**2 + dy**2) ** 0.5
                        if velocity > self.VELOCITY_THRESHOLD:
                            suspicious = True

                # Arm extension check (elbow angle)
                for sh, el, wr in [
                    (self.KP_LEFT_SHOULDER,  self.KP_LEFT_ELBOW,  self.KP_LEFT_WRIST),
                    (self.KP_RIGHT_SHOULDER, self.KP_RIGHT_ELBOW, self.KP_RIGHT_WRIST),
                ]:
                    if sh < len(kps_full) and el < len(kps_full) and wr < len(kps_full):
                        angle = self._angle(kps_full[sh], kps_full[el], kps_full[wr])
                        if angle > self.ARM_EXTEND_THRESHOLD:
                            suspicious = True

                self._prev_kps[i] = kps_full

            # Also check person overlap
            if self._overlap_based(person_boxes):
                suspicious = True

        except Exception:
            return self._overlap_based(person_boxes)

        if suspicious:
            self._alert_frames += 1
        else:
            self._alert_frames = max(0, self._alert_frames - 1)

        return self._alert_frames >= Config.FIGHTING_FRAMES

    def _overlap_based(self, person_boxes):
        """Fallback: check if person bounding boxes overlap heavily."""
        if len(person_boxes) < 2:
            return False
        for i in range(len(person_boxes)):
            for j in range(i+1, len(person_boxes)):
                if self._iou(person_boxes[i], person_boxes[j]) > self.OVERLAP_THRESHOLD:
                    return True
        return False

    @staticmethod
    def _iou(a, b):
        x1 = max(a[0], b[0]); y1 = max(a[1], b[1])
        x2 = min(a[2], b[2]); y2 = min(a[3], b[3])
        if x2 <= x1 or y2 <= y1:
            return 0.0
        inter = (x2-x1)*(y2-y1)
        union = ((a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter)
        return inter / union if union > 0 else 0.0

    @staticmethod
    def _angle(a, b, c):
        """Angle at point b (elbow) formed by a-b-c."""
        ba = np.array([a[0]-b[0], a[1]-b[1]], dtype=float)
        bc = np.array([c[0]-b[0], c[1]-b[1]], dtype=float)
        n1, n2 = np.linalg.norm(ba), np.linalg.norm(bc)
        if n1 < 1e-6 or n2 < 1e-6:
            return 0.0
        cos_a = np.clip(np.dot(ba, bc) / (n1 * n2), -1.0, 1.0)
        return float(np.degrees(np.arccos(cos_a)))


# ════════════════════════════════════════════════════════════════════════
#  DETECTOR 6 — Talking  (MediaPipe mouth openness)
# ════════════════════════════════════════════════════════════════════════

class TalkingDetector:
    MOUTH_THRESHOLD = 0.05

    def detect(self, landmarks):
        if landmarks is None:
            return None
        upper = landmarks.landmark[13].y
        lower = landmarks.landmark[14].y
        return "Talking" if abs(lower - upper) > self.MOUTH_THRESHOLD else None


# ════════════════════════════════════════════════════════════════════════
#  ALERT MANAGER — Severity scoring
# ════════════════════════════════════════════════════════════════════════

class AlertManager:
    WEIGHTS = {
        "Fighting": 10, "Cheating": 8,
        "Sleeping": 6, "Phone": 5,
        "Drowsy": 4, "Eating": 3, "Drinking": 3,
        "Talking": 2,
    }

    @staticmethod
    def severity(behaviors):
        if "Fighting" in behaviors:         return "critical"
        if any(b in behaviors for b in ["Cheating", "Sleeping"]): return "high"
        if any(b in behaviors for b in ["Phone", "Drowsy"]):       return "medium"
        if any(b in behaviors for b in ["Talking","Eating","Drinking"]): return "low"
        return "normal"

    @staticmethod
    def score(behaviors):
        return sum(AlertManager.WEIGHTS.get(b, 0) for b in behaviors)

    # Severity → BGR color for drawing
    COLORS = {
        "critical": (0,   0, 255),
        "high":     (0, 140, 255),
        "medium":   (0, 200, 255),
        "low":      (0, 200, 100),
        "normal":   (0, 255, 100),
    }


# ════════════════════════════════════════════════════════════════════════
#  FACE DETECTION (MediaPipe Tasks API — 0.10+)
# ════════════════════════════════════════════════════════════════════════

class _LandmarkCompat:
    """
    Wraps the mediapipe Tasks API landmark list so that existing behaviour
    detectors can still use  landmarks.landmark[idx].x / .y / .z
    without any changes.
    """
    def __init__(self, lm_list):
        self.landmark = lm_list   # list of NormalizedLandmark


class FaceDetectionModule:
    _MODEL_URL  = ("https://storage.googleapis.com/mediapipe-models/"
                   "face_landmarker/face_landmarker/float16/1/face_landmarker.task")
    _MODEL_PATH = Path("face_landmarker.task")

    def __init__(self):
        self.landmarker = None
        if not _mediapipe:
            return
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as _mp_py
            from mediapipe.tasks.python import vision as _mp_vis

            # Auto-download model if missing
            if not self._MODEL_PATH.exists():
                import urllib.request
                print(f"  ⬇ Downloading face_landmarker.task …")
                urllib.request.urlretrieve(self._MODEL_URL, self._MODEL_PATH)

            opts = _mp_vis.FaceLandmarkerOptions(
                base_options           = _mp_py.BaseOptions(model_asset_path=str(self._MODEL_PATH)),
                running_mode           = _mp_vis.RunningMode.IMAGE,
                num_faces              = 6,
                min_face_detection_confidence = 0.45,
                min_face_presence_confidence  = 0.45,
                min_tracking_confidence       = 0.45,
            )
            self.landmarker = _mp_vis.FaceLandmarker.create_from_options(opts)
            print("  ✓ MediaPipe FaceLandmarker (Tasks API)")
        except Exception as e:
            print(f"  ✗ MediaPipe FaceLandmarker: {e}")

    def detect(self, frame):
        """Returns list of dicts with 'rect' and 'landmarks'."""
        faces = []
        if self.landmarker is None:
            return faces
        try:
            import mediapipe as mp
            small = cv2.resize(frame, (640, 480))
            rgb   = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = self.landmarker.detect(mp_img)

            if not result.face_landmarks:
                return faces

            sx = frame.shape[1] / 640
            sy = frame.shape[0] / 480

            for face_lms in result.face_landmarks:
                xs = [lm.x * 640 for lm in face_lms]
                ys = [lm.y * 480 for lm in face_lms]
                x1 = int((min(xs) - 10) * sx)
                y1 = int((min(ys) - 10) * sy)
                x2 = int((max(xs) + 10) * sx)
                y2 = int((max(ys) + 10) * sy)
                x1, y1 = max(0, x1), max(0, y1)
                x2 = min(frame.shape[1], x2)
                y2 = min(frame.shape[0], y2)
                faces.append({
                    "rect":      (x1, y1, x2, y2),
                    "landmarks": _LandmarkCompat(face_lms),
                })
        except Exception:
            pass
        return faces


# ════════════════════════════════════════════════════════════════════════
#  PIPELINE ORCHESTRATOR
# ════════════════════════════════════════════════════════════════════════

class TrackifyPipeline:
    def __init__(self):
        print("\nInitializing Trackify AI Pipeline v4...")

        self.face_recognizer = FaceRecognitionDetector()
        self.face_detector   = FaceDetectionModule()
        self.sleeping        = SleepingDetector()
        self.cheating        = CheatingDetector()
        self.objects         = ObjectDetector()
        self.fighting        = FightingDetector()
        self.talking_det     = TalkingDetector()

        # ── Tracking + Counting ────────────────────────────────────────
        self.tracker = PersonTracker(
            iou_high = Config.TRACK_IOU_HIGH,
            iou_low  = Config.TRACK_IOU_LOW,
            max_age  = Config.TRACK_MAX_AGE,
            min_hits = Config.TRACK_MIN_HITS,
        )
        self.counter = ClassroomCounter(
            confirm_seconds = Config.ATTEND_CONFIRM_SEC,
            gap_tolerance   = Config.ATTEND_GAP_TOL,
            vote_window     = Config.VOTE_WINDOW,
            vote_threshold  = Config.VOTE_THRESHOLD,
            min_confidence  = Config.MIN_RECOG_CONF,
        )

        # ── Student enrollment filter + identity stability ─────────────
        self.student_filter  = StudentFilter()
        self.identity_binder = IdentityBinder()

        self.face_recognizer.load_students()

        # Sync registered names into counter after loading
        self.counter.set_registered(self.face_recognizer.names)

        self._ai_thread   = None
        self._cam_thread  = None

    # ── AI Worker Thread ────────────────────────────────────────────────

    def _ai_worker(self):
        """
        Upgraded pipeline (v4):
          YOLO persons → PersonTracker → InsightFace recognition
          → RecognitionVoter → AttendanceBuffer
          → MediaPipe behaviour analysis
          → AlertManager
        """
        while True:
            with _locks["frame"]:
                raw = _state["frame"]
            if raw is None:
                time.sleep(0.04)
                continue

            frame = raw.copy()
            h, w  = frame.shape[:2]

            try:
                # ── Step 1: YOLO — detect persons + objects ─────────────
                objects      = self.objects.detect(frame)
                person_boxes = objects["persons"]

                # ── Step 2: Track persons → stable IDs ─────────────────
                confirmed_tracks, removed_ids = self.tracker.update(person_boxes)

                # Notify counter + identity binder about deleted tracks
                for tid in removed_ids:
                    self.counter.remove_track(tid)
                    self.identity_binder.track_lost(tid)

                # Expire grace periods each frame
                self.identity_binder.expire_grace_periods()

                # Refresh student enrollment filter if stale (non-blocking)
                if self.student_filter.needs_refresh():
                    threading.Thread(
                        target=self.student_filter.refresh, daemon=True
                    ).start()

                # ── Step 3: Fight detection (scene-level) ───────────────
                fight = self.fighting.detect(frame, person_boxes)

                # ── Step 4: MediaPipe face detections on full frame ──────
                # (used for behaviour landmarks; matched to tracks below)
                face_detections = self.face_detector.detect(frame)
                face_map = match_faces_to_tracks(face_detections, confirmed_tracks)
                # face_map: {track_id: face_dict | None}

                faces_data = []
                rects_data = []

                for track in confirmed_tracks:
                    tid  = track.id
                    tx1, ty1, tx2, ty2 = track.get_bbox()

                    # Clamp to frame boundaries
                    tx1 = max(0, tx1); ty1 = max(0, ty1)
                    tx2 = min(w, tx2); ty2 = min(h, ty2)
                    if tx2 <= tx1 or ty2 <= ty1:
                        continue

                    # ── Step 5: Face recognition per track ─────────────
                    fd  = face_map.get(tid)
                    rect = fd["rect"] if fd else (tx1, ty1, tx2, ty2)
                    lms  = fd["landmarks"] if fd else None

                    name, conf, code, sid = self.face_recognizer.recognize(frame, rect)

                    # ── Step 6: Vote-stabilise name + update attendance ─
                    stable_name, just_confirmed = self.counter.update_with_confirm(tid, name, conf)

                    # ── Step 6b: Lock identity + enrollment filter ───────
                    # resolve() returns the confirmed stable student_id for
                    # this track (locked once attendance is confirmed).
                    stable_sid = self.identity_binder.resolve(tid, sid, just_confirmed)
                    # Only process students enrolled in the active course.
                    if stable_sid and stable_name != "Unknown":
                        if not self.student_filter.is_enrolled(stable_sid):
                            stable_sid = None  # not enrolled — skip dispatch

                    # ── DISPATCH: attendance confirmed ───────────────────
                    if just_confirmed and stable_sid and stable_name != "Unknown":
                        _dispatcher.push_attendance(student_id=stable_sid, confidence=conf)

                    # ── Step 7: Behaviour detection (per track ID) ──────
                    behaviors = []

                    if fight:
                        behaviors.append("Fighting")

                    sleep_r = self.sleeping.detect(tid, lms)
                    if sleep_r:
                        behaviors.append(sleep_r)

                    cheat = self.cheating.detect(tid, lms, w, h)
                    if cheat:
                        behaviors.append("Cheating")

                    talk = self.talking_det.detect(lms)
                    if talk:
                        behaviors.append(talk)

                    # Object overlap → phone / eating / drinking
                    for pb in objects["phones"]:
                        if self._overlaps((tx1,ty1,tx2,ty2), pb):
                            behaviors.append("Phone")
                    for fb in objects["food"]:
                        if self._overlaps((tx1,ty1,tx2,ty2), fb):
                            behaviors.append("Eating")
                    for db in objects["drink"]:
                        if self._overlaps((tx1,ty1,tx2,ty2), db):
                            behaviors.append("Drinking")

                    behaviors     = list(set(behaviors))
                    behavior_text = ", ".join(behaviors) if behaviors else "Normal"
                    severity      = AlertManager.severity(behaviors)

                    # ── DISPATCH: behavior events ─────────────────────────
                    if stable_sid and stable_name != "Unknown":
                        _BEHAVIOR_MAP = {
                            "Fighting": "fighting", "Sleeping": "sleeping",
                            "Drowsy":   "drowsy",   "Cheating": "cheating",
                            "Talking":  "talking",  "Phone":    "phone",
                        }
                        for b in behaviors:
                            bkey = _BEHAVIOR_MAP.get(b)
                            if bkey:
                                _dispatcher.push_behavior(
                                    student_id=stable_sid,
                                    behavior_type=bkey,
                                    confidence=conf,
                                )

                    # ── Step 8: Alerts + event log ──────────────────────
                    for b in behaviors:
                        _inc_alert(b)
                    if severity in ("critical", "high") and behaviors:
                        _log_event(stable_name, behavior_text, severity, code)

                    # Attendance progress (0–1) for overlay bar
                    progress = self.counter.streak_progress(stable_name)

                    faces_data.append({
                        "name":              stable_name,
                        "raw_name":          name,
                        "student_code":      code,
                        "student_id":        stable_sid or sid,
                        "track_id":          tid,
                        "behavior":          behavior_text,
                        "behaviors":         behaviors,
                        "severity":          severity,
                        "confidence":        round(conf, 2),
                        "attend_progress":   round(progress, 2),
                    })
                    rects_data.append(((tx1, ty1, tx2, ty2), faces_data[-1]))

                # ── Step 9: Update counting state ───────────────────────
                counting_snap = self.counter.snapshot()
                with _locks["counting"]:
                    _state["counting"] = counting_snap

                with _locks["ai"]:
                    _state["ai"]["faces"]      = faces_data
                    _state["ai"]["face_count"] = len(confirmed_tracks)
                    _state["ai"]["rects"]      = rects_data

            except Exception:
                pass  # never crash the AI thread

    @staticmethod
    def _overlaps(face, obj, threshold=0.1):
        """Check if object bbox overlaps face bbox."""
        xi1, yi1 = max(face[0], obj[0]), max(face[1], obj[1])
        xi2, yi2 = min(face[2], obj[2]), min(face[3], obj[3])
        if xi2 <= xi1 or yi2 <= yi1:
            return False
        inter = (xi2-xi1)*(yi2-yi1)
        face_area = (face[2]-face[0])*(face[3]-face[1])
        return face_area > 0 and inter/face_area > threshold

    # ── Camera Loop ─────────────────────────────────────────────────────

    def run_camera(self):
        # DSHOW is the only reliable backend on this machine
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  Config.FRAME_W)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, Config.FRAME_H)
        cap.set(cv2.CAP_PROP_FPS,          Config.CAMERA_FPS)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not cap.isOpened():
            print("✗ Camera not found")
            return

        # Warm up — let auto-exposure settle
        print("⏳ Camera warming up...")
        for _ in range(Config.WARMUP_FRAMES):
            cap.read()
        print("✓ Camera ready")

        # Start AI thread
        self._ai_thread = threading.Thread(target=self._ai_worker, daemon=True)
        self._ai_thread.start()

        fps_frames = 0
        fps_start  = time.time()
        current_fps = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.01)
                continue

            with _locks["active"]:
                active = _state["active"]

            if not active:
                time.sleep(0.02)
                continue

            frame = cv2.flip(frame, 1)

            # FPS
            fps_frames += 1
            now = time.time()
            if now - fps_start >= 1.0:
                current_fps = fps_frames
                fps_frames  = 0
                fps_start   = now

            # Draw AI results on frame
            with _locks["ai"]:
                rects      = list(_state["ai"]["rects"])
                faces_data = list(_state["ai"]["faces"])
                face_count = _state["ai"]["face_count"]

            # ── Read counting snapshot for overlay ─────────────────────
            with _locks["counting"]:
                cnt = dict(_state["counting"])

            for (x1,y1,x2,y2), info in rects:
                sev   = info.get("severity", "normal")
                color = AlertManager.COLORS.get(sev, (0,255,0))
                if info["name"] == "Unknown":
                    color = (120, 120, 120)

                cv2.rectangle(frame, (x1,y1), (x2,y2), color, 2)

                # ── Name + confidence label ─────────────────────────────
                display = info["name"]
                label   = f"{display}  {int(info['confidence']*100)}%"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
                cv2.rectangle(frame, (x1, y1-th-8), (x1+tw+4, y1), color, -1)
                cv2.putText(frame, label, (x1+2, y1-4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0,0,0), 1)

                # ── Attendance progress bar (below bbox) ────────────────
                prog  = info.get("attend_progress", 0.0)
                bar_w = x2 - x1
                bar_h = 4
                cv2.rectangle(frame, (x1, y2+2), (x2, y2+2+bar_h), (50,50,50), -1)
                filled = int(bar_w * prog)
                bar_color = (0, 220, 90) if prog >= 1.0 else (0, 180, 255)
                if filled > 0:
                    cv2.rectangle(frame, (x1, y2+2), (x1+filled, y2+2+bar_h), bar_color, -1)

                # ── Behaviour tag ───────────────────────────────────────
                if info["behavior"] != "Normal":
                    cv2.putText(frame, info["behavior"], (x1, y2+20),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255,220,0), 1)

                # ── Track ID (small, top-right of box) ─────────────────
                tid_label = f"#{info.get('track_id','?')}"
                cv2.putText(frame, tid_label, (x2-30, y1-4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200,200,200), 1)

            # ── Counting HUD (top-left panel) ───────────────────────────
            present_c  = len(cnt.get("present_confirmed", []))
            in_frame   = cnt.get("total_in_frame", 0)
            unknown_c  = cnt.get("unknown_in_frame", 0)
            registered = cnt.get("total_registered", 0)
            absent_c   = len(cnt.get("absent", []))

            hud_lines = [
                f"FPS: {current_fps}",
                f"In frame : {in_frame}",
                f"Confirmed: {present_c}/{registered}",
                f"Unknown  : {unknown_c}",
                f"Absent   : {absent_c}",
            ]
            panel_h = len(hud_lines) * 20 + 10
            cv2.rectangle(frame, (0, 0), (175, panel_h), (0,0,0), -1)
            for li, line in enumerate(hud_lines):
                color_hud = (0, 255, 160) if li == 2 else (200, 200, 200)
                cv2.putText(frame, line, (6, 18 + li*20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.48, color_hud, 1)

            with _locks["frame"]:
                _state["frame"] = frame.copy()

            with _locks["counting"]:
                cnt_snap = dict(_state["counting"])

            with _locks["status"]:
                _state["status"] = {
                    "faces":      faces_data,
                    "face_count": face_count,
                    "fps":        current_fps,
                    "connected":  True,
                    # Embed summary counts directly into status for the frontend
                    "present_count":    len(cnt_snap.get("present_confirmed", [])),
                    "unknown_count":    cnt_snap.get("unknown_in_frame", 0),
                    "absent_count":     len(cnt_snap.get("absent", [])),
                    "total_registered": cnt_snap.get("total_registered", 0),
                    "attendance_rate":  cnt_snap.get("attendance_rate", 0.0),
                }

        cap.release()

    # ── Start / Reload ──────────────────────────────────────────────────

    def reload_students(self):
        self.face_recognizer.names      = []
        self.face_recognizer.codes      = []
        self.face_recognizer.ids        = []
        self.face_recognizer.embeddings = np.array([])
        self.face_recognizer.load_students()
        # Keep counter in sync with updated student list
        self.counter.set_registered(self.face_recognizer.names)
        return len(self.face_recognizer.names)

    def reset_session(self):
        """Reset tracker, counter, attendance, dispatcher, filter, and binder."""
        self.tracker.reset()
        self.counter.reset_session()
        _dispatcher.reset_session()
        self.student_filter.reset()
        self.identity_binder.reset()
        with _locks["counting"]:
            _state["counting"] = {
                "present_confirmed": [], "present_in_frame": [],
                "absent": [], "unknown_in_frame": 0,
                "total_in_frame": 0, "total_registered": len(self.face_recognizer.names),
                "attendance_rate": 0.0, "newly_confirmed": [],
            }


# ════════════════════════════════════════════════════════════════════════
#  FLASK API SERVER
# ════════════════════════════════════════════════════════════════════════

if _flask:
    app = Flask(__name__)

    @app.after_request
    def cors(r):
        r.headers["Access-Control-Allow-Origin"]  = "*"
        r.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return r

    def _mjpeg_frames():
        while True:
            with _locks["frame"]:
                f = _state["frame"]
            if f is None:
                time.sleep(0.02)
                continue
            ok, buf = cv2.imencode(".jpg", f, [cv2.IMWRITE_JPEG_QUALITY, 72])
            if ok:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
            time.sleep(0.033)  # ~30fps cap

    @app.route("/video_feed")
    def video_feed():
        return Response(_mjpeg_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")

    @app.route("/snapshot")
    def snapshot():
        """Single JPEG frame — polled by frontend every ~80ms instead of MJPEG."""
        with _locks["frame"]:
            f = _state["frame"]
        if f is None:
            f = np.zeros((480, 640, 3), np.uint8)
        ok, buf = cv2.imencode(".jpg", f, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if not ok:
            return Response(status=204)
        resp = Response(buf.tobytes(), mimetype="image/jpeg")
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        return resp

    @app.route("/stream")
    def stream():
        """Server-Sent Events — real-time status + alerts + counting."""
        def generate():
            while True:
                with _locks["status"]:
                    data = dict(_state["status"])
                with _locks["alerts"]:
                    data["alerts"] = dict(_state["alerts"])
                with _locks["counting"]:
                    data["counting"] = dict(_state["counting"])
                data["uptime"] = int(time.time() - _state["session_start"])
                yield f"data: {json.dumps(data)}\n\n"
                time.sleep(0.12)
        return Response(generate(), mimetype="text/event-stream",
                        headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

    @app.route("/status")
    def get_status():
        with _locks["status"]:
            d = dict(_state["status"])
        return jsonify(d)

    @app.route("/alerts")
    def get_alerts():
        with _locks["alerts"]:
            return jsonify(dict(_state["alerts"]))

    @app.route("/alerts/reset", methods=["POST","OPTIONS"])
    def reset_alerts():
        with _locks["alerts"]:
            for k in _state["alerts"]:
                _state["alerts"][k] = 0
        _state["session_start"] = time.time()
        return jsonify({"reset": True})

    @app.route("/events")
    def get_events():
        """Last 50 behavior events."""
        with _locks["events"]:
            evs = list(_state["events"])[:50]
        return jsonify(evs)

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "version": "3.0", "students":
                        len(pipeline.face_recognizer.names) if "pipeline" in globals() else 0})

    @app.route("/start", methods=["POST","OPTIONS"])
    def start_camera():
        with _locks["active"]:
            _state["active"] = True
        # Immediately inject session context from the frontend payload
        # so the dispatcher doesn't have to wait for the next 20-second poll.
        try:
            body = request.get_json(silent=True) or {}
            session_id = body.get("session_id")
            course_id  = body.get("course_id")
            if session_id and course_id:
                _dispatcher.set_session(session_id, course_id)
                print(f"▶ Camera started | session:{session_id} | course:{course_id}")
            else:
                print("▶ Camera started (no session context in payload)")
        except Exception as e:
            print(f"▶ Camera started (could not parse body: {e})")
        return jsonify({"started": True})

    @app.route("/stop", methods=["POST","OPTIONS"])
    def stop_camera():
        with _locks["active"]:
            _state["active"] = False
        with _locks["frame"]:
            _state["frame"] = None
        with _locks["status"]:
            _state["status"]["faces"]      = []
            _state["status"]["face_count"] = 0
        # Reset tracker + counter for next session
        if "pipeline" in globals():
            pipeline.reset_session()
        print("■ Camera stopped")
        return jsonify({"stopped": True})

    @app.route("/debug")
    def debug():
        p = pipeline if "pipeline" in globals() else None
        return jsonify({
            "students_loaded": len(p.face_recognizer.names) if p else 0,
            "students": [{"name": n, "code": c}
                         for n, c in zip(p.face_recognizer.names, p.face_recognizer.codes)] if p else [],
            "insightface": _insightface is not None,
            "mediapipe":   _mediapipe   is not None,
            "yolo":        _ultralytics is not None,
            "pose_model":  p.fighting.pose_model is not None if p else False,
        })

    @app.route("/reload-students", methods=["POST","OPTIONS"])
    def reload_students():
        if "pipeline" not in globals():
            return jsonify({"success": False, "error": "pipeline not ready"})
        n = pipeline.reload_students()
        return jsonify({"success": True, "students_loaded": n})

    @app.route("/attendance")
    def get_attendance():
        """
        Full attendance snapshot for the current session.
        Returns present, absent, unknown count, and attendance rate.
        """
        with _locks["counting"]:
            snap = dict(_state["counting"])
        return jsonify(snap)

    @app.route("/counting")
    def get_counting():
        """
        Live counting summary — who is in frame right now.
        Lighter than /attendance; useful for real-time dashboards.
        """
        with _locks["counting"]:
            c = dict(_state["counting"])
        return jsonify({
            "total_in_frame":    c.get("total_in_frame",    0),
            "present_in_frame":  c.get("present_in_frame",  []),
            "unknown_in_frame":  c.get("unknown_in_frame",  0),
            "present_confirmed": c.get("present_confirmed", []),
            "total_registered":  c.get("total_registered",  0),
            "attendance_rate":   c.get("attendance_rate",   0.0),
        })

    @app.route("/session/reset", methods=["POST","OPTIONS"])
    def reset_session_route():
        """Reset tracker + attendance for a new session without stopping camera."""
        if "pipeline" in globals():
            pipeline.reset_session()
        return jsonify({"reset": True})


# ════════════════════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"\n{'═'*60}")
    print("  TRACKIFY AI PIPELINE v3  —  Multi-Model System")
    print(f"{'═'*60}")

    pipeline = TrackifyPipeline()

    # Start backend event dispatcher
    _dispatcher.start()
    print("✓ Event dispatcher started")

    cam_thread = threading.Thread(target=pipeline.run_camera, daemon=True)
    cam_thread.start()

    if _flask:
        print(f"\n✓ API server → http://localhost:{Config.FLASK_PORT}")
        print(f"  /video_feed     MJPEG stream")
        print(f"  /stream         SSE real-time updates")
        print(f"  /attendance     full attendance snapshot")
        print(f"  /counting       live in-frame count")
        print(f"  /session/reset  reset tracker + attendance")
        print(f"  /debug          loaded students")
        print(f"  /events         behavior event log")
        print(f"  /alerts         session alert counts\n")
        # Prevent Flask from trying to load python-dotenv on Python 3.14+
        # (causes a colorama/Windows console crash when .env exists)
        os.environ["FLASK_SKIP_DOTENV"] = "1"
        app.run(host=Config.FLASK_HOST, port=Config.FLASK_PORT,
                threaded=True, use_reloader=False)
    else:
        cam_thread.join()
