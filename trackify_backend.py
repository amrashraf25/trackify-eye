# ── IMPORTS ──────────────────────────────────────────────────────────────────
import cv2
import numpy as np
import os
import sys
from datetime import datetime

# Fix Unicode output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import time
import threading
import requests

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
# ── Supabase config (reads student photos from the website) ──
SUPABASE_URL = "http://localhost:3001"
SUPABASE_KEY = "local-anon-key"
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

print(f"Python version: {sys.version}")
print(f"OpenCV version: {cv2.__version__}")
print(f"NumPy version: {np.__version__}")

# ── OPTIONAL DEPENDENCY LOADING ───────────────────────────────────────────────
# Each block tries to import a library and sets a flag used as a guard throughout.

# Flask serves the REST API and MJPEG video stream to the frontend
try:
    from flask import Flask, Response, jsonify
    FLASK_AVAILABLE = True
    print("✓ Flask loaded successfully")
except ImportError as e:
    print(f"✗ Flask not available: {e}")
    print("  Install with: pip install flask")
    FLASK_AVAILABLE = False

# Ultralytics YOLO for behavior and object detection (phone, fighting, etc.)
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
    print("✓ YOLO loaded successfully")
except ImportError as e:
    print(f"✗ YOLO not available: {e}")
    YOLO_AVAILABLE = False

# MediaPipe FaceMesh for landmark-based behavior (cheating, talking, drowsy)
try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
    print("✓ MediaPipe loaded successfully")
except ImportError as e:
    print(f"✗ MediaPipe not available: {e}")
    MEDIAPIPE_AVAILABLE = False

# InsightFace for 512-dim face embeddings used in recognition
try:
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
    print("✓ InsightFace loaded successfully")
except ImportError as e:
    print(f"✗ InsightFace not available: {e}")
    INSIGHTFACE_AVAILABLE = False

# Cosine similarity from scikit-learn for matching live embeddings to the DB
try:
    from sklearn.metrics.pairwise import cosine_similarity
    COSINE_SIM_AVAILABLE = True
    print("✓ scikit-learn loaded successfully")
except ImportError as e:
    print(f"✗ scikit-learn not available: {e}")
    COSINE_SIM_AVAILABLE = False


# ── SHARED STATE ─────────────────────────────────────────────────────────────
# All globals below are accessed from both the camera thread and Flask handlers;
# each has a dedicated Lock to prevent race conditions.
_current_frame = None
_detection_status = {"faces": [], "face_count": 0, "fps": 0, "connected": True}
_frame_lock = threading.Lock()   # guards _current_frame
_status_lock = threading.Lock()  # guards _detection_status
_ai_lock = threading.Lock()      # guards _ai_results (written by AI worker, read by camera loop)
_ai_results = {"faces": [], "face_count": 0, "rects": []}
_behavior_alerts = {"fighting": 0, "cheating": 0, "sleeping": 0, "phone": 0, "talking": 0, "drowsy": 0}
_alerts_lock = threading.Lock()
_session_start = time.time()
_camera_active = False          # camera only runs when frontend presses Start
_camera_lock = threading.Lock()
_camera_index = -1              # which camera index is actually being used

# ── Active session (set by /start, cleared by /stop) ─────────────────
_active_session_id  = None
_active_course_id   = None
_session_lock       = threading.Lock()

# ── Attendance dedup: track which student_ids already reported ───────
# Maps student_id -> timestamp of last successful POST
_attendance_reported = {}       # { student_id: time.time() }
_attendance_lock     = threading.Lock()
ATTENDANCE_COOLDOWN  = 60       # re-report at most once per 60 s per student

# ── Behavior dedup: per (student_id, behavior_type) cooldown ─────────
# Maps (student_id, behavior_type) -> timestamp of last successful POST
_behavior_reported = {}         # { (student_id, behavior_type): time.time() }
_behavior_lock     = threading.Lock()
BEHAVIOR_COOLDOWN  = 30         # re-report same behavior at most once per 30 s

# Map Python behavior labels → API behavior_type values
BEHAVIOR_TYPE_MAP = {
    "Cheating":  "cheating",
    "Talking":   "talking",
    "Sleeping":  "sleeping",
    "Drowsy":    "drowsy",
    "Fighting":  "fighting",
    "Phone":     "phone",
    "Drinking":  "drinking",
    "Eating":    "eating",
}

LOCAL_API_URL        = "http://localhost:3001"
# ===============================================================


# ── FLASK API SERVER ──────────────────────────────────────────────────────────
if FLASK_AVAILABLE:
    app = Flask(__name__)

    # Attach CORS headers to every response so the React frontend can call this API
    @app.after_request
    def add_cors(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    # Handle preflight OPTIONS requests for all routes (required by browsers for CORS)
    @app.route("/", methods=["OPTIONS"])
    @app.route("/<path:path>", methods=["OPTIONS"])
    def handle_options(path=""):
        response = app.make_default_options_response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    # Generator that yields MJPEG frames; sleeps 20 ms between frames (~50 fps max)
    def _generate_frames():
        while True:
            with _frame_lock:
                frame = _current_frame
            if frame is None:
                time.sleep(0.02)
                continue
            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if not ok:
                continue
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                   + buf.tobytes() + b"\r\n")
            time.sleep(0.02)

    # Streams the annotated camera feed as multipart MJPEG to the browser
    @app.route("/video_feed")
    def video_feed():
        return Response(
            _generate_frames(),
            mimetype="multipart/x-mixed-replace; boundary=frame"
        )

    # Returns the latest detection snapshot (faces, behaviors, fps) as JSON
    @app.route("/status")
    def get_status():
        with _status_lock:
            data = dict(_detection_status)
        return jsonify(data)

    # Simple liveness probe used by the frontend to check the backend is up
    @app.route("/health")
    def health():
        return jsonify({"status": "ok"})

    # Activates the camera loop and records the active session/course IDs for API reporting
    @app.route("/start", methods=["POST", "OPTIONS"])
    def start_camera():
        global _camera_active, _active_session_id, _active_course_id
        data = {}
        try:
            import flask
            data = flask.request.get_json(silent=True) or {}
        except Exception:
            pass
        with _camera_lock:
            _camera_active = True
        with _session_lock:
            _active_session_id = data.get("session_id") or None
            _active_course_id  = data.get("course_id")  or None
        # Clear previous dedup maps so each session starts fresh
        with _attendance_lock:
            _attendance_reported.clear()
        with _behavior_lock:
            _behavior_reported.clear()
        print(f"▶ Camera started | session={_active_session_id} course={_active_course_id}")
        return jsonify({"started": True})

    # Deactivates the camera loop and clears all in-memory detection state
    @app.route("/stop", methods=["POST", "OPTIONS"])
    def stop_camera():
        global _camera_active, _current_frame, _active_session_id, _active_course_id
        with _camera_lock:
            _camera_active = False
        with _frame_lock:
            _current_frame = None
        with _status_lock:
            _detection_status["faces"] = []
            _detection_status["face_count"] = 0
        with _ai_lock:
            _ai_results["faces"] = []
            _ai_results["face_count"] = 0
            _ai_results["rects"] = []
        with _session_lock:
            _active_session_id = None
            _active_course_id  = None
        with _attendance_lock:
            _attendance_reported.clear()
        with _behavior_lock:
            _behavior_reported.clear()
        print("■ Camera stopped by frontend")
        return jsonify({"stopped": True})

    # Diagnostic endpoint: shows loaded students and which AI libraries are active
    @app.route("/debug")
    def debug():
        names = recognizer.student_names if 'recognizer' in globals() else []
        codes = recognizer.student_codes if 'recognizer' in globals() else []
        scb_loaded = recognizer.scb_model is not None if 'recognizer' in globals() else False
        return jsonify({
            "students_loaded": len(names),
            "students": [{"name": n, "code": c} for n, c in zip(names, codes)],
            "insightface": INSIGHTFACE_AVAILABLE,
            "mediapipe": MEDIAPIPE_AVAILABLE,
            "yolo": YOLO_AVAILABLE,
            "scb_model": scb_loaded,
            "camera_index": _camera_index,
        })

    # Re-fetches student photos and embeddings from Supabase without restarting
    @app.route("/reload-students", methods=["POST", "OPTIONS"])
    def reload_students():
        if 'recognizer' in globals():
            recognizer.student_embeddings = []
            recognizer.student_names = []
            recognizer.student_codes = []
            recognizer.student_ids = []
            recognizer.load_students_from_supabase()
            return jsonify({"success": True, "students_loaded": len(recognizer.student_names)})
        return jsonify({"success": False, "error": "recognizer not ready"})

    # Server-Sent Events stream: pushes detection + alert data ~8 times per second
    @app.route("/stream")
    def stream():
        import json as _json
        def generate():
            while True:
                with _status_lock:
                    data = dict(_detection_status)
                with _alerts_lock:
                    data['alerts'] = dict(_behavior_alerts)
                data['uptime'] = int(time.time() - _session_start)
                yield f"data: {_json.dumps(data)}\n\n"
                time.sleep(0.12)
        return Response(generate(), mimetype='text/event-stream',
                        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*'})

    # Returns cumulative behavior alert counts for the current session
    @app.route("/alerts")
    def get_alerts():
        with _alerts_lock:
            return jsonify(dict(_behavior_alerts))

    # Resets all alert counters and restarts the session timer
    @app.route("/alerts/reset", methods=["POST", "OPTIONS"])
    def reset_alerts():
        global _session_start
        with _alerts_lock:
            for k in _behavior_alerts:
                _behavior_alerts[k] = 0
        _session_start = time.time()
        return jsonify({"reset": True})

    # ── FILE UPLOAD / SERVE / DELETE ─────────────────────────────────────────
    import os as _os, uuid as _uuid, mimetypes as _mimetypes
    from flask import send_file as _send_file, abort as _abort, request as _request

    # Persistent storage folder for teacher-uploaded course materials
    _UPLOAD_DIR = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "uploads")
    _os.makedirs(_UPLOAD_DIR, exist_ok=True)

    # Whitelist of accepted file extensions to block executable uploads
    _ALLOWED_EXTENSIONS = {
        '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
        '.txt', '.png', '.jpg', '.jpeg', '.gif', '.webp',
        '.mp4', '.mov', '.zip', '.rar'
    }

    # Accepts a multipart file, validates its extension, and stores it under a UUID name
    @app.route("/upload", methods=["POST", "OPTIONS"])
    def upload_file():
        if _request.method == "OPTIONS":
            return jsonify({}), 200
        if 'file' not in _request.files:
            return jsonify({"error": "No file provided"}), 400
        file = _request.files['file']
        if not file or not file.filename:
            return jsonify({"error": "Empty file"}), 400

        # Get extension and validate
        ext = _os.path.splitext(file.filename)[1].lower()
        if ext not in _ALLOWED_EXTENSIONS:
            return jsonify({"error": f"File type '{ext}' not allowed"}), 400

        # Save with unique name to avoid collisions
        safe_name = _os.path.basename(file.filename).replace(' ', '_')
        unique_name = f"{_uuid.uuid4().hex}_{safe_name}"
        save_path = _os.path.join(_UPLOAD_DIR, unique_name)
        file.save(save_path)

        file_url = f"http://localhost:5000/files/{unique_name}"
        file_size = _os.path.getsize(save_path)
        print(f"[Upload] Saved: {unique_name} ({file_size} bytes)")
        return jsonify({
            "url": file_url,
            "name": file.filename,
            "stored_name": unique_name,
            "size": file_size,
        })

    # Serves a previously uploaded file; strips UUID prefix when setting download name
    @app.route("/files/<filename>", methods=["GET"])
    def serve_file(filename):
        # Prevent directory traversal
        safe = _os.path.basename(filename)
        path = _os.path.join(_UPLOAD_DIR, safe)
        if not _os.path.exists(path):
            _abort(404)
        mime, _ = _mimetypes.guess_type(path)
        return _send_file(path, mimetype=mime or 'application/octet-stream',
                          as_attachment=False,
                          download_name=safe.split('_', 1)[-1] if '_' in safe else safe)

    # Deletes a file from the uploads folder by its stored (UUID-prefixed) name
    @app.route("/files/<filename>", methods=["DELETE"])
    def delete_file(filename):
        safe = _os.path.basename(filename)
        path = _os.path.join(_UPLOAD_DIR, safe)
        if _os.path.exists(path):
            _os.remove(path)
            return jsonify({"deleted": True})
        return jsonify({"deleted": False, "error": "Not found"}), 404

    # Returns metadata for every file currently in the uploads directory
    @app.route("/files", methods=["GET"])
    def list_files():
        files = []
        for f in _os.listdir(_UPLOAD_DIR):
            fp = _os.path.join(_UPLOAD_DIR, f)
            files.append({"name": f, "size": _os.path.getsize(fp),
                           "url": f"http://localhost:5000/files/{f}"})
        return jsonify(files)
    # ─────────────────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────


# ── CORE RECOGNITION & DETECTION CLASS ───────────────────────────────────────
# FastFaceRecognition owns all AI models, runs the camera loop, and coordinates
# face detection, recognition, behavior analysis, and API reporting.
class FastFaceRecognition:
    # Initialises all AI models and loads student embeddings from Supabase
    def __init__(self):
        self.face_app = None        # InsightFace FaceAnalysis instance
        self.behavior_model = None  # Active YOLO model (custom or COCO)
        self.mp_face = None         # MediaPipe FaceMesh instance

        # Parallel lists: index i describes the same student across all four
        self.student_embeddings = []
        self.student_names = []
        self.student_codes = []
        self.student_ids = []

        # Frame-skip intervals: run heavy AI every N frames to save CPU
        self.face_detection_interval = 2
        self.recognition_interval = 4
        self.yolo_interval = 6

        self.last_faces = []
        self.last_recognition = {}
        self.last_yolo_results = []

        # Eye-closure frames counter for drowsy/sleeping detection
        self.eye_closed_frames   = 0
        # Number of consecutive closed-eye frames required to flag Sleeping
        self.sleeping_threshold  = 10
        self._cheating_frames    = 0   # sustained sideways-look counter
        self._talking_frames     = 0   # sustained mouth-open counter
        self._fighting_frames    = 0   # sustained fighting counter
        self._phone_frames       = 0   # sustained phone counter

        print("\nInitializing components...")

        # ── InsightFace model (buffalo_l) for 512-dim face embeddings ──
        # det_size=320 balances speed vs accuracy on CPU
        if INSIGHTFACE_AVAILABLE:
            try:
                self.face_app = FaceAnalysis(name="buffalo_l", providers=['CPUExecutionProvider'])
                self.face_app.prepare(ctx_id=0, det_size=(320, 320))
                print("✓ FaceAnalysis initialized")
            except Exception as e:
                self.face_app = None

        self.custom_model = None   # Custom trained behavior model
        self.object_model = None   # COCO model for eating/drinking fallback

        if YOLO_AVAILABLE:
            # Try custom trained model first (detects: person, phone_use, sleeping, cheating, fighting)
            CUSTOM_MODEL_PATH = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "trackify_behavior.pt"
            )
            if os.path.exists(CUSTOM_MODEL_PATH):
                try:
                    self.custom_model = YOLO(CUSTOM_MODEL_PATH)
                    print(f"✓ Custom behavior model loaded ({self.custom_model.names})")
                    self.behavior_model = self.custom_model
                except Exception as e:
                    print(f"⚠ Custom model failed to load: {e}")

            # Always load COCO model for eating/drinking (bottle/cup) detection
            # Also used as primary behavior model if custom model not available
            try:
                self.object_model = YOLO("yolov8n.pt")
                print("✓ COCO object model loaded (eating/drinking fallback)")
                if self.behavior_model is None:
                    self.behavior_model = self.object_model
                    print("  → Using COCO model as primary (no custom model found)")
            except Exception as e:
                if self.behavior_model is None:
                    self.behavior_model = None

        # FaceMesh tracks 468 landmarks in real time; refine_landmarks adds iris points
        if MEDIAPIPE_AVAILABLE:
            try:
                self.mp_face = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=False,
                    max_num_faces=2,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                print("✓ MediaPipe FaceMesh initialized")
            except Exception as e:
                self.mp_face = None

        self.load_students_from_supabase()


    # ── STUDENT LOADING ───────────────────────────────────────────────────────
    # Fetches active students with photos from Supabase, downloads each avatar,
    # extracts an InsightFace embedding, and stores it for later matching.
    def load_students_from_supabase(self):
        print("Fetching students from Supabase...")
        try:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/students",
                params={
                    "select": "id,student_code,full_name,avatar_url",
                    "status": "eq.active",
                    "avatar_url": "not.is.null",
                },
                headers=SUPABASE_HEADERS,
                timeout=15,
            )
            res.raise_for_status()
            students = res.json()
        except Exception as e:
            print(f"✗ Could not fetch students from Supabase: {e}")
            return

        if not students:
            print("⚠ No students with photos found in the database")
            return

        loaded_count = 0
        for student in students:
            name  = student.get("full_name", "").strip()
            url   = student.get("avatar_url", "")
            sid   = student.get("id", "")
            scode = student.get("student_code", "")
            if not name or not url:
                continue
            try:
                img_res = requests.get(url, timeout=10)
                img_res.raise_for_status()
                # Decode raw bytes into a BGR numpy array (standard OpenCV format)
                img_array = np.frombuffer(img_res.content, np.uint8)
                image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                # Fallback: use Pillow for formats OpenCV can't handle (WebP, HEIC, etc.)
                if image is None:
                    try:
                        from PIL import Image
                        import io
                        pil_img = Image.open(io.BytesIO(img_res.content)).convert("RGB")
                        image = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                    except Exception:
                        print(f"  ✗ {name}: could not decode image — try uploading a JPG or PNG")
                        continue
                if image is None:
                    print(f"  ✗ {name}: could not decode image — try uploading a JPG or PNG")
                    continue
                embedding = self.extract_face_embedding(image, use_loader=True)
                if embedding is None:
                    # Try upscaled — small thumbnails can fail InsightFace detection
                    big = cv2.resize(image, (640, 640))
                    embedding = self.extract_face_embedding(big, use_loader=True)
                if embedding is None:
                    # Try rotations (photo might be sideways)
                    for angle in [cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE, cv2.ROTATE_180]:
                        rotated = cv2.rotate(image, angle)
                        embedding = self.extract_face_embedding(rotated, use_loader=True)
                        if embedding is not None:
                            break
                if embedding is not None:
                    self.student_embeddings.append(embedding)
                    self.student_names.append(name)
                    self.student_codes.append(scode)
                    self.student_ids.append(sid)
                    loaded_count += 1
                    print(f"  ✓ {name} ({scode})")
                else:
                    print(f"  ✗ {name}: no face detected — upload a clear front-facing photo")
            except Exception as e:
                print(f"  ✗ {name}: {e}")
                continue

        if self.student_embeddings:
            # Stack list of 1-D arrays into a 2-D matrix for batch cosine similarity
            self.student_embeddings = np.array(self.student_embeddings)
            print(f"✓ Loaded {loaded_count}/{len(students)} students from Supabase")
        else:
            print("⚠ No face embeddings could be extracted — check that InsightFace is installed")


    # ── FACE EMBEDDING ────────────────────────────────────────────────────────
    # Runs InsightFace on a single image and returns a unit-normalised embedding vector
    def extract_face_embedding(self, image, use_loader=False):
        if self.face_app is None:
            return None
        try:
            faces = self.face_app.get(image)
            if not faces:
                return None
            embedding = faces[0].embedding
            # L2-normalise so cosine similarity = dot product (faster comparison)
            return embedding / np.linalg.norm(embedding)
        except Exception:
            return None


    # ── FACE DETECTION ────────────────────────────────────────────────────────
    # Returns a list of {'rect': (x1,y1,x2,y2), 'landmarks': ...} dicts.
    # Prefers MediaPipe (includes 468-point landmarks); falls back to InsightFace bbox only.
    def detect_faces_fast(self, frame):
        # Try MediaPipe first
        if self.mp_face is not None:
            # MediaPipe expects RGB; work on a 640x480 copy for speed
            small_frame = cv2.resize(frame, (640, 480))
            rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            results = self.mp_face.process(rgb_frame)

            faces = []
            if results.multi_face_landmarks:
                for face_landmarks in results.multi_face_landmarks:
                    h, w = small_frame.shape[:2]
                    # Derive a bounding box from the min/max of all 468 landmark coords
                    x_coords = [lm.x * w for lm in face_landmarks.landmark]
                    y_coords = [lm.y * h for lm in face_landmarks.landmark]

                    x1 = int(min(x_coords)) - 10
                    y1 = int(min(y_coords)) - 10
                    x2 = int(max(x_coords)) + 10
                    y2 = int(max(y_coords)) + 10

                    # Scale bounding box from 640x480 back to original frame dimensions
                    scale_x = frame.shape[1] / 640
                    scale_y = frame.shape[0] / 480
                    x1, x2 = int(x1 * scale_x), int(x2 * scale_x)
                    y1, y2 = int(y1 * scale_y), int(y2 * scale_y)

                    # Clamp to frame boundaries
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)

                    faces.append({
                        'rect': (x1, y1, x2, y2),
                        'landmarks': face_landmarks
                    })
            return faces

        # Fallback: use InsightFace detector directly (no landmark data available)
        if self.face_app is not None:
            try:
                detected = self.face_app.get(frame)
                faces = []
                for f in detected:
                    box = f.bbox.astype(int)
                    x1, y1, x2, y2 = box[0], box[1], box[2], box[3]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)
                    faces.append({'rect': (x1, y1, x2, y2), 'landmarks': None})
                return faces
            except Exception:
                pass

        return []


    # ── FACE RECOGNITION ─────────────────────────────────────────────────────
    # Crops the face region, extracts its embedding, and finds the best match in the
    # student DB using cosine similarity. Returns (name, score, code, id).
    def recognize_face_fast(self, frame, face_rect):
        if self.face_app is None or len(self.student_embeddings) == 0:
            return "Unknown", 0.0, "", ""

        x1, y1, x2, y2 = face_rect

        try:
            face_region = frame[y1:y2, x1:x2]
            if face_region.size == 0:
                return "Unknown", 0.0, "", ""

            faces = self.face_app.get(face_region)
            if not faces:
                return "Unknown", 0.0, "", ""

            current_embedding = faces[0].embedding
            # Normalise to unit length for cosine similarity comparison
            current_embedding = current_embedding / np.linalg.norm(current_embedding)

            # Batch compare live embedding against all stored student embeddings
            similarities = cosine_similarity(self.student_embeddings, current_embedding.reshape(1, -1)).flatten()
            best_match_idx = np.argmax(similarities)
            best_similarity = similarities[best_match_idx]

            # 0.28 cosine threshold — empirically tuned: below = too many false positives
            if best_similarity > 0.28:
                return (
                    self.student_names[best_match_idx],
                    best_similarity,
                    self.student_codes[best_match_idx] if best_match_idx < len(self.student_codes) else "",
                    self.student_ids[best_match_idx] if best_match_idx < len(self.student_ids) else "",
                )
            else:
                return "Unknown", best_similarity, "", ""

        except Exception:
            return "Unknown", 0.0, "", ""


    # ── BEHAVIOR DETECTION ───────────────────────────────────────────────────

    # Detects sustained sideways head turn using the nose-to-eye-midpoint offset ratio.
    # Returns True only after 18+ consecutive frames of lateral offset > 0.42.
    def detect_cheating(self, face_landmarks):
        """Sustained sideways head turn (>0.5 s) = possible cheating."""
        if face_landmarks is None:
            self._cheating_frames = max(0, self._cheating_frames - 1)
            return self._cheating_frames >= 18

        nose      = face_landmarks.landmark[1]
        left_eye  = face_landmarks.landmark[33]
        right_eye = face_landmarks.landmark[263]
        # Inter-eye distance used to normalise the nose offset (scale-invariant)
        eye_width = abs(right_eye.x - left_eye.x)

        # Face fully in profile — can't tell direction reliably, don't flag
        if eye_width < 0.03:
            self._cheating_frames = max(0, self._cheating_frames - 2)
            return self._cheating_frames >= 18

        eye_mid_x    = (left_eye.x + right_eye.x) / 2
        offset_ratio = abs(nose.x - eye_mid_x) / eye_width

        # Raised from 0.32 → 0.42 so casual glances don't count
        if offset_ratio > 0.42:
            self._cheating_frames += 1
        else:
            self._cheating_frames = max(0, self._cheating_frames - 2)

        # ~18 frames ≈ 0.6 s of sustained sideways look
        return self._cheating_frames >= 18

    # Returns True if the chin-to-nose vertical ratio indicates the head is pitched forward
    def detect_head_drooping(self, face_landmarks):
        """Head pitched forward (drowsy/sleeping) via landmark geometry."""
        if face_landmarks is None:
            return False
        forehead = face_landmarks.landmark[10]
        nose     = face_landmarks.landmark[1]
        chin     = face_landmarks.landmark[152]
        face_h = abs(chin.y - forehead.y)
        if face_h < 0.01:
            return False
        # When the chin-nose gap is <22% of total face height, the head is drooping
        return (chin.y - nose.y) / face_h < 0.22

    # Detects physical altercation by checking if two valid person boxes heavily overlap
    def detect_fighting(self, person_boxes):
        """Two clearly-separate people with heavy overlap sustained for 8+ frames."""
        # Discard tiny ghost detections (min 50px wide, 80px tall)
        valid = [(x1, y1, x2, y2) for x1, y1, x2, y2 in person_boxes
                 if (x2 - x1) > 50 and (y2 - y1) > 80]

        close = False
        if len(valid) >= 2:
            for i in range(len(valid)):
                for j in range(i + 1, len(valid)):
                    x1a, y1a, x2a, y2a = valid[i]
                    x1b, y1b, x2b, y2b = valid[j]

                    # Skip if one box is completely inside the other (same person)
                    if (x1a >= x1b and x2a <= x2b and y1a >= y1b and y2a <= y2b):
                        continue
                    if (x1b >= x1a and x2b <= x2a and y1b >= y1a and y2b <= y2a):
                        continue

                    # Compute intersection area of the two person boxes
                    xi1, yi1 = max(x1a, x1b), max(y1a, y1b)
                    xi2, yi2 = min(x2a, x2b), min(y2a, y2b)
                    if xi2 > xi1 and yi2 > yi1:
                        inter = (xi2 - xi1) * (yi2 - yi1)
                        a_min = min((x2a - x1a) * (y2a - y1a),
                                    (x2b - x1b) * (y2b - y1b))
                        # Raised from 0.25 → 0.45 — must really overlap, not just stand close
                        if a_min > 0 and inter / a_min > 0.45:
                            close = True

        if close:
            self._fighting_frames = min(self._fighting_frames + 1, 20)
        else:
            self._fighting_frames = max(0, self._fighting_frames - 1)

        # Must sustain for 8 consecutive frames before flagging
        return self._fighting_frames >= 8

    # Returns True when both eye openness values (upper-lower landmark gap) fall below 0.01
    def detect_eyes_closed(self, face_landmarks):
        if face_landmarks is None:
            return False

        # Vertical distance between upper and lower eyelid landmarks for each eye
        left_eye_top = face_landmarks.landmark[159].y
        left_eye_bottom = face_landmarks.landmark[145].y
        left_eye_openness = abs(left_eye_bottom - left_eye_top)

        right_eye_top = face_landmarks.landmark[386].y
        right_eye_bottom = face_landmarks.landmark[374].y
        right_eye_openness = abs(right_eye_bottom - right_eye_top)

        # Both eyes must be nearly closed (< 0.01 in normalised coords)
        return left_eye_openness < 0.01 and right_eye_openness < 0.01

    # Computes Mouth Aspect Ratio and increments a frame counter to detect sustained talking
    def detect_talking(self, face_landmarks):
        """Mouth Aspect Ratio > threshold for 5+ frames = actually talking."""
        if face_landmarks is None:
            self._talking_frames = max(0, self._talking_frames - 1)
            return self._talking_frames >= 5

        upper_lip   = face_landmarks.landmark[13]
        lower_lip   = face_landmarks.landmark[14]
        left_mouth  = face_landmarks.landmark[61]
        right_mouth = face_landmarks.landmark[291]

        mouth_h = abs(lower_lip.y - upper_lip.y)
        mouth_w = abs(right_mouth.x - left_mouth.x)

        # Mouth Aspect Ratio — normalised by width so face distance doesn't matter
        mar = (mouth_h / mouth_w) if mouth_w > 0.001 else 0.0

        if mar > 0.18:           # clearly open — talking/yelling
            self._talking_frames += 2
        elif mar > 0.10:         # slightly open — might be talking
            self._talking_frames += 1
        else:
            self._talking_frames = max(0, self._talking_frames - 2)

        self._talking_frames = min(self._talking_frames, 20)   # cap buildup
        return self._talking_frames >= 3


    # ── YOLO DETECTION ───────────────────────────────────────────────────────
    # Per-class minimum confidence thresholds for custom model.
    # Higher = fewer false positives but lower recall. Values tuned per class mAP.
    CUSTOM_MIN_CONF = {
        'person':    0.30,
        'phone_use': 0.18,   # Lowered: model has low mAP for phones — tuned for higher recall
        'sleeping':  0.35,
        'cheating':  0.40,
        'fighting':  0.50,
        'talking':   0.35,
        'eating':    0.30,
        'drinking':  0.30,
    }

    # Runs the active YOLO model on a single frame and returns filtered detections.
    # Applies per-class confidence thresholds on top of the global 0.25 base threshold.
    def run_yolo_detection(self, frame):
        if self.behavior_model is None:
            return []

        try:
            # Resize to 640x480 for YOLO — keep full detail, don't upscale a tiny frame
            yolo_frame = cv2.resize(frame, (640, 480))
            results = self.behavior_model.predict(
                yolo_frame,
                verbose=False,
                conf=0.25,   # Low base threshold — per-class filtering applied below
                imgsz=640
            )[0]

            detected_objects = []
            for box in results.boxes:
                label = self.behavior_model.names[int(box.cls[0])].lower()
                conf  = float(box.conf[0])

                # Apply per-class confidence filter to reduce class-specific noise
                min_conf = self.CUSTOM_MIN_CONF.get(label, 0.40)
                if conf < min_conf:
                    continue

                bx1, by1, bx2, by2 = map(int, box.xyxy[0])
                # Scale bbox coordinates back from 640x480 to the original frame size
                sx = frame.shape[1] / 640
                sy = frame.shape[0] / 480
                bx1, bx2 = int(bx1 * sx), int(bx2 * sx)
                by1, by2 = int(by1 * sy), int(by2 * sy)

                detected_objects.append({
                    'label': label,
                    'conf':  conf,
                    'bbox':  (bx1, by1, bx2, by2)
                })

            return detected_objects

        except Exception:
            return []


    # ── BEHAVIOR AGGREGATION ─────────────────────────────────────────────────
    # Combines custom YOLO model detections, MediaPipe landmark signals, and COCO
    # object detections to produce a deduplicated list of behavior labels for one face.
    def detect_behaviors(self, face_data, yolo_objects, person_boxes=None, all_objects=None, scb_detections=None):
        behaviors = []
        person_boxes  = person_boxes  or []
        all_objects   = all_objects or yolo_objects

        # ── Custom model detections (phone_use, sleeping, cheating, fighting) ──
        # These come directly from the trained model with sustained frame requirements
        if self.custom_model is not None:
            CUSTOM_MAP = {
                'phone_use': 'Phone',
                'sleeping':  'Sleeping',
                'cheating':  'Cheating',
                'fighting':  'Fighting',
            }
            # Minimum consecutive frames before reporting (prevents single-frame spam)
            FRAME_THRESH = {
                'phone_use': 2,   # Lowered to fire faster on phones
                'sleeping':  3,
                'cheating':  4,
                'fighting':  4,
            }

            x1, y1, x2, y2 = face_data['rect']
            detected_this_frame = set()

            for obj in all_objects:
                label = obj['label']
                if label not in CUSTOM_MAP:
                    continue
                bx1, by1, bx2, by2 = obj['bbox']
                fw = (x2 - x1)
                fh = (y2 - y1)
                # Expand face bbox to catch body-level detections.
                # Phones are usually held in front/below the face — be generous downward and laterally.
                if label == 'phone_use':
                    ey1 = max(0, y1 - int(fh * 1.0))
                    ey2 = y2 + int(fh * 4.0)
                    ex1 = max(0, x1 - int(fw * 1.5))
                    ex2 = x2 + int(fw * 1.5)
                else:
                    expand_y = fh * 2
                    ey1 = max(0, y1 - int(expand_y * 0.3))
                    ey2 = y2 + int(expand_y)
                    ex1 = max(0, x1 - int(fw * 0.5))
                    ex2 = x2 + int(fw * 0.5)

                if bx2 < ex1 or bx1 > ex2 or by2 < ey1 or by1 > ey2:
                    continue

                detected_this_frame.add(label)

            # Fighting & Cheating: require 2+ people in the scene
            # Fighting = two people hitting each other
            # Cheating = copying from another student (needs someone nearby)
            # Use face count (MediaPipe — very reliable) OR YOLO person count, whichever is higher
            yolo_persons = sum(1 for o in all_objects if o['label'] == 'person')
            face_persons = getattr(self, '_current_face_count', 1)
            person_count = max(yolo_persons, face_persons)
            if 'fighting' in detected_this_frame and person_count < 2:
                detected_this_frame.discard('fighting')
            if 'cheating' in detected_this_frame and person_count < 2:
                detected_this_frame.discard('cheating')

            # Update sustained frame counters
            for label in CUSTOM_MAP:
                counter_attr = f'_custom_{label}_frames'
                if not hasattr(self, counter_attr):
                    setattr(self, counter_attr, 0)

                if label in detected_this_frame:
                    setattr(self, counter_attr, min(getattr(self, counter_attr) + 1, 30))
                else:
                    # Decay slowly (allow brief gaps in detection)
                    setattr(self, counter_attr, max(0, getattr(self, counter_attr) - 2))

                if getattr(self, counter_attr) >= FRAME_THRESH[label]:
                    behaviors.append(CUSTOM_MAP[label])

        else:
            # ── Fallback: old heuristic path (when no custom model) ──
            phone_source = all_objects

            if face_data['landmarks'] is not None:
                lm = face_data['landmarks']
                if self.detect_cheating(lm):
                    behaviors.append("Cheating")
                eyes_shut = self.detect_eyes_closed(lm)
                head_drop = self.detect_head_drooping(lm)
                if eyes_shut or head_drop:
                    self.eye_closed_frames += 1
                    if self.eye_closed_frames >= self.sleeping_threshold:
                        behaviors.append("Sleeping")
                    elif self.eye_closed_frames >= self.sleeping_threshold // 2:
                        behaviors.append("Drowsy")
                else:
                    self.eye_closed_frames = 0

            if self.detect_fighting(person_boxes):
                behaviors.append("Fighting")

            phone_raw = any("cell" in obj['label'] or "phone" in obj['label']
                            for obj in phone_source)
            if phone_raw:
                self._phone_frames = min(self._phone_frames + 1, 15)
            else:
                self._phone_frames = max(0, self._phone_frames - 2)
            if self._phone_frames >= 4:
                behaviors.append("Phone")

        # ── Talking: always use MediaPipe (no dataset had talking class) ──
        if face_data['landmarks'] is not None:
            if self.detect_talking(face_data['landmarks']):
                behaviors.append("Talking")

        # ── Drowsy: always use MediaPipe eye closure as secondary signal ──
        if self.custom_model is not None and face_data['landmarks'] is not None:
            if "Sleeping" not in behaviors:
                eyes_shut = self.detect_eyes_closed(face_data['landmarks'])
                head_drop = self.detect_head_drooping(face_data['landmarks'])
                if eyes_shut or head_drop:
                    self.eye_closed_frames += 1
                    if self.eye_closed_frames >= self.sleeping_threshold // 2:
                        behaviors.append("Drowsy")
                else:
                    self.eye_closed_frames = 0

        # ── Eating/Drinking: COCO model fallback (bottle, cup, food, wine glass) ──
        for obj in all_objects:
            label = obj['label']
            if any(k in label for k in ["bottle", "cup", "wine glass", "glass"]):
                behaviors.append("Drinking")
            if label in ["apple", "banana", "sandwich", "orange", "pizza", "donut", "cake", "hot dog", "bowl"]:
                behaviors.append("Eating")

        # Update global alert counters
        with _alerts_lock:
            for b in behaviors:
                key = b.lower()
                if key in _behavior_alerts:
                    _behavior_alerts[key] += 1

        return list(set(behaviors))


    # ── AI WORKER THREAD ─────────────────────────────────────────────────────
    # Continuously processes the latest frame in a background thread so the
    # camera capture loop never stalls waiting for model inference.
    def _ai_worker(self):
        """Runs AI detection in a background thread — never blocks the camera loop."""
        while True:
            with _frame_lock:
                frame = _current_frame.copy() if _current_frame is not None else None
            if frame is None:
                time.sleep(0.05)
                continue

            # Shrink to 320p for AI — much faster
            small = cv2.resize(frame, (320, 240))

            faces = self.detect_faces_fast(small)

            # Scale rects back to full frame
            sx = frame.shape[1] / 320
            sy = frame.shape[0] / 240
            for f in faces:
                x1, y1, x2, y2 = f['rect']
                f['rect'] = (int(x1*sx), int(y1*sy), int(x2*sx), int(y2*sy))

            # Pass full-res frame so YOLO sees real detail (phones are small!)
            yolo_objects = self.run_yolo_detection(frame)
            person_boxes = []
            for obj in yolo_objects:
                if obj['label'] == 'person':
                    person_boxes.append(obj['bbox'])

            # If custom model is primary, also run COCO model for eating/drinking
            if self.custom_model is not None and self.object_model is not None and self.object_model != self.custom_model:
                try:
                    coco_frame = cv2.resize(frame, (640, 480))
                    coco_res = self.object_model.predict(coco_frame, verbose=False, conf=0.30, imgsz=640)[0]
                    sx = frame.shape[1] / 640
                    sy = frame.shape[0] / 480
                    for box in coco_res.boxes:
                        label = self.object_model.names[int(box.cls[0])].lower()
                        # Only keep food/drink objects
                        if any(k in label for k in ["bottle", "cup", "wine glass", "glass", "bowl", "apple", "banana", "sandwich", "orange", "pizza", "donut", "cake", "hot dog"]):
                            conf = float(box.conf[0])
                            bx1, by1, bx2, by2 = map(int, box.xyxy[0])
                            yolo_objects.append({
                                'label': label, 'conf': conf,
                                'bbox': (int(bx1*sx), int(by1*sy), int(bx2*sx), int(by2*sy))
                            })
                except Exception:
                    pass

            scb_detections = []  # No longer needed — custom model handles sleeping/cheating

            # Store face count so detect_behaviors can use it for person counting
            self._current_face_count = len(faces)

            faces_data = []
            for i, face_data in enumerate(faces):
                x1, y1, x2, y2 = face_data['rect']

                face_specific_objects = [
                    obj for obj in yolo_objects
                    if not (obj['bbox'][2] < x1 or obj['bbox'][0] > x2 or
                            obj['bbox'][3] < y1 or obj['bbox'][1] > y2)
                ]

                # SCB detections overlapping this face bbox (BowHead / TurnHead)
                face_scb = [
                    d for d in scb_detections
                    if not (d['bbox'][2] < x1 or d['bbox'][0] > x2 or
                            d['bbox'][3] < y1 or d['bbox'][1] > y2)
                ]

                student_name, similarity, student_code, student_id = \
                    self.recognize_face_fast(frame, (x1, y1, x2, y2))

                behaviors = self.detect_behaviors(face_data, face_specific_objects, person_boxes, yolo_objects, face_scb)
                behavior_text = ", ".join(behaviors) if behaviors else "Normal"

                # Map detected behaviors to a severity tier used for box color coding
                sev = "normal"
                if "Fighting" in behaviors:
                    sev = "critical"
                elif any(b in behaviors for b in ["Cheating", "Sleeping"]):
                    sev = "high"
                elif any(b in behaviors for b in ["Phone", "Drowsy"]):
                    sev = "medium"
                elif any(b in behaviors for b in ["Talking", "Eating", "Drinking"]):
                    sev = "low"

                faces_data.append({
                    "name": student_name,
                    "student_code": student_code,
                    "student_id": student_id,
                    "behavior": behavior_text,
                    "behaviors": behaviors,
                    "severity": sev,
                    "confidence": round(float(similarity), 2)
                })

                # ── Attendance reporting ──────────────────────────────
                # Fire-and-forget POST to local-api when a known student
                # is recognised (student_id set, similarity above threshold).
                # A 60-second per-student cooldown prevents duplicate rows.
                # Threshold matches recognize_face_fast display threshold (>0.28)
                # plus a small buffer — same face that shows a name gets recorded.
                if student_id and student_id != "" and similarity >= 0.30:
                    with _session_lock:
                        sid  = _active_session_id
                        cid  = _active_course_id

                    now = time.time()
                    should_report = False
                    with _attendance_lock:
                        last = _attendance_reported.get(student_id, 0)
                        if now - last >= ATTENDANCE_COOLDOWN:
                            _attendance_reported[student_id] = now
                            should_report = True

                    if should_report:
                        def _post_attendance(s_id, sess_id, course_id, conf):
                            payload = {
                                "student_id": s_id,
                                "session_id": sess_id,
                                "course_id":  course_id,
                                "confidence": conf,
                            }
                            try:
                                resp = requests.post(
                                    f"{LOCAL_API_URL}/api/ai/attendance",
                                    json=payload,
                                    timeout=5
                                )
                                print(f"✓ Attendance marked | student={s_id} session={sess_id} → {resp.status_code}")
                            except Exception as e:
                                print(f"✗ Attendance POST failed: {e}")

                        t = threading.Thread(
                            target=_post_attendance,
                            args=(student_id, sid, cid, round(float(similarity), 2)),
                            daemon=True
                        )
                        t.start()

                # ── Behavior reporting ────────────────────────────────
                # For each non-Normal behavior on a known student, POST
                # to local-api with a per-(student, behavior) 30-s cooldown.
                if student_id and student_id != "" and behaviors:
                    with _session_lock:
                        bsid = _active_session_id
                        bcid = _active_course_id

                    now = time.time()
                    for beh in behaviors:
                        beh_type = BEHAVIOR_TYPE_MAP.get(beh)
                        if not beh_type:
                            continue  # skip unmapped / "Normal"

                        key = (student_id, beh_type)
                        should_log = False
                        with _behavior_lock:
                            last_b = _behavior_reported.get(key, 0)
                            if now - last_b >= BEHAVIOR_COOLDOWN:
                                _behavior_reported[key] = now
                                should_log = True

                        if should_log:
                            def _post_behavior(s_id, sess_id, course_id, b_type, conf):
                                payload = {
                                    "student_id":    s_id,
                                    "session_id":    sess_id,
                                    "course_id":     course_id,
                                    "behavior_type": b_type,
                                    "confidence":    conf,
                                    "duration_sec":  0,
                                }
                                try:
                                    resp = requests.post(
                                        f"{LOCAL_API_URL}/api/ai/behavior",
                                        json=payload,
                                        timeout=5
                                    )
                                    print(f"✓ Behavior logged  | student={s_id} type={b_type} → {resp.status_code}")
                                except Exception as e:
                                    print(f"✗ Behavior POST failed: {e}")

                            t = threading.Thread(
                                target=_post_behavior,
                                args=(student_id, bsid, bcid, beh_type,
                                      round(float(similarity), 2)),
                                daemon=True
                            )
                            t.start()

            with _ai_lock:
                _ai_results['faces'] = faces_data
                _ai_results['face_count'] = len(faces)
                _ai_results['rects'] = [(f['rect'], faces_data[i]) for i, f in enumerate(faces)]

    # ── CAMERA LOOP ───────────────────────────────────────────────────────────
    # Opens the first available camera, warms it up, spawns the AI worker thread,
    # then runs the main capture-annotate-publish loop until the process exits.
    def run_camera(self):
        global _current_frame, _detection_status, _camera_index

        import platform
        IS_WINDOWS = platform.system() == "Windows"

        # ── Simplified reliable camera opener ─────────────────────────
        # On Python 3.10+ / Windows 11, threaded MSMF/DSHOW probing locks
        # the camera handle. Instead: open directly without threads, using
        # CAP_DSHOW first (most stable on Win11), then plain VideoCapture.
        cap = None
        working_index = 0

        if IS_WINDOWS:
            # Try indices 0-2 with DSHOW (no thread — avoids handle lock)
            for idx in range(3):
                print(f'Trying camera {idx} [DSHOW]...')
                try:
                    c = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
                    if c.isOpened():
                        c.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                        c.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        ret, frame = c.read()
                        if ret and frame is not None and frame.size > 0:
                            cap = c
                            working_index = idx
                            _camera_index = idx
                            print(f'✓ Camera {idx} opened [DSHOW]')
                            break
                        else:
                            c.release()
                    else:
                        c.release()
                except Exception as e:
                    print(f'  Camera {idx} DSHOW error: {e}')
        else:
            for idx in range(3):
                print(f'Trying camera {idx}...')
                try:
                    c = cv2.VideoCapture(idx)
                    if c.isOpened():
                        c.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                        c.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        ret, frame = c.read()
                        if ret and frame is not None and frame.size > 0:
                            cap = c
                            working_index = idx
                            _camera_index = idx
                            print(f'✓ Camera {idx} opened')
                            break
                        else:
                            c.release()
                    else:
                        c.release()
                except Exception as e:
                    print(f'  Camera {idx} error: {e}')

        if cap is None:
            print('⚠ Fallback: VideoCapture(0)')
            cap = cv2.VideoCapture(0)
            working_index = 0
            _camera_index = 0

        if not cap.isOpened():
            print('ERROR: No camera available')
            print('  Fix: Windows Settings > Privacy > Camera > allow desktop apps')
            with _status_lock:
                _detection_status['connected'] = False
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        # 1-second final warmup
        print(f'Warming up camera {working_index}...')
        warmup_end = time.time() + 1.0
        while time.time() < warmup_end:
            cap.read()
            time.sleep(0.033)
        print('✓ Camera ready')

        # Start AI worker thread
        ai_thread = threading.Thread(target=self._ai_worker, daemon=True)
        ai_thread.start()

        fps_start   = time.time()
        fps_count   = 0
        current_fps = 0
        fail_count  = 0   # consecutive read failures → trigger reconnect

        while True:
            try:
                ret, frame = cap.read()
            except Exception:
                ret, frame = False, None

            if not ret or frame is None or frame.size == 0:
                fail_count += 1
                if fail_count >= 30:
                    # Camera disconnected — try to reopen
                    print(f'⚠ Camera read failed {fail_count}x — attempting reconnect...')
                    cap.release()
                    time.sleep(1.0)
                    # Reconnect using the same reliable approach
                    new_cap = None
                    try:
                        if IS_WINDOWS:
                            new_cap = cv2.VideoCapture(working_index, cv2.CAP_DSHOW)
                        else:
                            new_cap = cv2.VideoCapture(working_index)
                        if new_cap and not new_cap.isOpened():
                            new_cap.release()
                            new_cap = None
                    except Exception:
                        new_cap = None
                    if new_cap is not None:
                        cap = new_cap
                        fail_count = 0
                        print('✓ Camera reconnected')
                    else:
                        print('✗ Reconnect failed — retrying in 2s')
                        time.sleep(2.0)
                else:
                    time.sleep(0.01)
                continue

            fail_count = 0
            frame = cv2.flip(frame, 1)

            with _camera_lock:
                active = _camera_active

            if not active:
                # Session not started — store a plain frame so the camera
                # stays warm (MSMF drops idle connections if frames aren't consumed)
                with _frame_lock:
                    _current_frame = frame.copy()
                time.sleep(0.033)   # ~30 fps idle drain
                continue

            fps_count += 1
            now = time.time()
            if now - fps_start >= 1.0:
                current_fps = fps_count
                fps_count   = 0
                fps_start   = now

            # Grab latest AI results (non-blocking)
            with _ai_lock:
                rects      = list(_ai_results.get('rects', []))
                faces_data = list(_ai_results.get('faces', []))
                face_count = _ai_results.get('face_count', 0)

            # ── FRAME ANNOTATION ──────────────────────────────────────────────
            # Draw cached AI results onto the live frame (non-blocking — uses last result)
            for (x1, y1, x2, y2), info in rects:
                sev = info.get('severity', 'normal')
                # Color encodes severity: red=critical, orange=high, yellow=medium, green=low/normal
                color = {
                    'critical': (0, 0, 255),
                    'high':     (0, 140, 255),
                    'medium':   (0, 200, 255),
                    'low':      (0, 200, 100),
                    'normal':   (0, 255, 100),
                }.get(sev, (0, 255, 0))
                if info['name'] == 'Unknown':
                    color = (120, 120, 120)   # grey box for unrecognised faces
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                label = f"{info['name']} ({int(info.get('confidence',0)*100)}%)"
                cv2.putText(frame, label, (x1, max(0, y1 - 10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                # Behavior text rendered below the bounding box in yellow
                cv2.putText(frame, info['behavior'], (x1, y2 + 18),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 220, 0), 1)

            cv2.putText(frame, f"FPS: {current_fps}", (10, 28),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            with _frame_lock:
                _current_frame = frame.copy()

            with _status_lock:
                _detection_status = {
                    "faces":      faces_data,
                    "face_count": face_count,
                    "fps":        current_fps,
                    "connected":  True,
                }

        cap.release()


# ── ENTRY POINT ───────────────────────────────────────────────────────────────
# Instantiates the recognizer, starts the camera thread, then launches Flask.
# Flask blocks the main thread; the camera runs as a daemon thread in the background.
if __name__ == "__main__":
    try:
        recognizer = FastFaceRecognition()

        # Run camera in a background thread so Flask can serve in parallel
        camera_thread = threading.Thread(target=recognizer.run_camera, daemon=True)
        camera_thread.start()

        if FLASK_AVAILABLE:
            print("\n✓ API server starting on http://localhost:5000")
            print("  Endpoints:")
            print("    http://localhost:5000/video_feed  — MJPEG stream")
            print("    http://localhost:5000/status      — detection JSON")
            print("    http://localhost:5000/health      — health check")
            # use_reloader=False prevents Flask from spawning a duplicate process
            app.run(host="0.0.0.0", port=5000, threaded=True, use_reloader=False)
        else:
            print("\n⚠ Flask not installed — frontend integration disabled.")
            print("  Install with: pip install flask")
            print("  Running in standalone mode (camera window only).")
            camera_thread.join()

    except Exception as e:
        print(f"Error: {e}")
