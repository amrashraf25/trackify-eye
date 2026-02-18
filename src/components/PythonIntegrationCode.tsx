import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EDGE_FUNCTION_URL = `https://itrtpjtzvujuovysvvre.supabase.co/functions/v1/camera-feed`;

const pythonCode = `import cv2
import numpy as np
import os
import sys
import requests
import json
from datetime import datetime
import time

print(f"Python version: {sys.version}")
print(f"OpenCV version: {cv2.__version__}")
print(f"NumPy version: {np.__version__}")

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
    print("✓ YOLO loaded successfully")
except ImportError as e:
    print(f"✗ YOLO not available: {e}")
    YOLO_AVAILABLE = False

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
    print("✓ MediaPipe loaded successfully")
except ImportError as e:
    print(f"✗ MediaPipe not available: {e}")
    MEDIAPIPE_AVAILABLE = False

try:
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
    print("✓ InsightFace loaded successfully")
except ImportError as e:
    print(f"✗ InsightFace not available: {e}")
    INSIGHTFACE_AVAILABLE = False

try:
    from sklearn.metrics.pairwise import cosine_similarity
    COSINE_SIM_AVAILABLE = True
    print("✓ scikit-learn loaded successfully")
except ImportError as e:
    print(f"✗ scikit-learn not available: {e}")
    COSINE_SIM_AVAILABLE = False


# ========== TRACKIFY BACKEND INTEGRATION ==========
EDGE_FUNCTION_URL = "${EDGE_FUNCTION_URL}"

def report_phone_detected(room_number, student_name=None):
    try:
        requests.post(EDGE_FUNCTION_URL, json={
            "action": "phone_detected",
            "data": {"room_number": room_number, "student_name": student_name}
        }, headers={"Content-Type": "application/json"}, timeout=3)
    except: pass

def report_behavior_alert(room_number, behavior, student_name=None, severity="medium"):
    try:
        requests.post(EDGE_FUNCTION_URL, json={
            "action": "behavior_alert",
            "data": {"room_number": room_number, "behavior": behavior, "student_name": student_name, "severity": severity}
        }, headers={"Content-Type": "application/json"}, timeout=3)
    except: pass

def report_incident(incident_type, room_number, severity="medium"):
    try:
        requests.post(EDGE_FUNCTION_URL, json={
            "action": "report_incident",
            "data": {"incident_type": incident_type, "room_number": room_number, "severity": severity}
        }, headers={"Content-Type": "application/json"}, timeout=3)
    except: pass

def update_attendance(student_id, course_name, status="present"):
    try:
        requests.post(EDGE_FUNCTION_URL, json={
            "action": "update_attendance",
            "data": {"student_id": student_id, "course_name": course_name, "status": status}
        }, headers={"Content-Type": "application/json"}, timeout=3)
    except: pass
# ===================================================


class FastFaceRecognition:
    def __init__(self):
        self.students_folder = r"D:\\students"
        self.room_number = "101"  # Change this per room

        self.face_app = None
        self.behavior_model = None
        self.mp_face = None

        self.student_embeddings = []
        self.student_names = []

        self.face_detection_interval = 2
        self.recognition_interval = 4
        self.yolo_interval = 6

        self.last_faces = []
        self.last_recognition = {}
        self.last_yolo_results = []

        self.eye_closed_frames = 0
        self.sleeping_threshold = 10

        # Cooldown to avoid spamming the backend
        self.last_report_time = {}
        self.report_cooldown = 10  # seconds between same incident reports

        print("\\nInitializing components...")

        if INSIGHTFACE_AVAILABLE:
            try:
                self.face_app = FaceAnalysis(name="buffalo_l", providers=['CPUExecutionProvider'])
                self.face_app.prepare(ctx_id=0, det_size=(160, 160))
                print("✓ FaceAnalysis initialized")
            except Exception as e:
                self.face_app = None

        if YOLO_AVAILABLE:
            try:
                self.behavior_model = YOLO("yolov8n.pt")
                print("✓ YOLO model loaded")
            except Exception as e:
                self.behavior_model = None

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

        self.load_students_from_folder()
        print(f"\\nStarting camera...")
        self.run_camera()

    def should_report(self, key):
        now = time.time()
        if key not in self.last_report_time or (now - self.last_report_time[key]) > self.report_cooldown:
            self.last_report_time[key] = now
            return True
        return False

    def load_students_from_folder(self):
        if not os.path.exists(self.students_folder):
            return
        valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp'}
        student_files = [f for f in os.listdir(self.students_folder)
                        if any(f.lower().endswith(ext) for ext in valid_extensions)]
        loaded_count = 0
        for file in student_files:
            file_path = os.path.join(self.students_folder, file)
            try:
                image = cv2.imread(file_path)
                if image is None:
                    continue
                student_name = os.path.splitext(file)[0]
                embedding = self.extract_face_embedding(image)
                if embedding is not None:
                    self.student_embeddings.append(embedding)
                    self.student_names.append(student_name)
                    loaded_count += 1
            except Exception:
                continue
        if self.student_embeddings:
            self.student_embeddings = np.array(self.student_embeddings)
            print(f"✓ Loaded {loaded_count} students")

    def extract_face_embedding(self, image):
        if self.face_app is None:
            return None
        try:
            faces = self.face_app.get(image)
            if not faces:
                return None
            embedding = faces[0].embedding
            return embedding / np.linalg.norm(embedding)
        except Exception:
            return None

    def detect_faces_fast(self, frame):
        if self.mp_face is None:
            return []
        small_frame = cv2.resize(frame, (640, 480))
        rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        results = self.mp_face.process(rgb_frame)
        faces = []
        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                h, w = small_frame.shape[:2]
                x_coords = [lm.x * w for lm in face_landmarks.landmark]
                y_coords = [lm.y * h for lm in face_landmarks.landmark]
                x1 = int(min(x_coords)) - 10
                y1 = int(min(y_coords)) - 10
                x2 = int(max(x_coords)) + 10
                y2 = int(max(y_coords)) + 10
                scale_x = frame.shape[1] / 640
                scale_y = frame.shape[0] / 480
                x1, x2 = int(x1 * scale_x), int(x2 * scale_x)
                y1, y2 = int(y1 * scale_y), int(y2 * scale_y)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)
                faces.append({'rect': (x1, y1, x2, y2), 'landmarks': face_landmarks})
        return faces

    def recognize_face_fast(self, frame, face_rect):
        if self.face_app is None or len(self.student_embeddings) == 0:
            return "Unknown", 0.0
        x1, y1, x2, y2 = face_rect
        try:
            face_region = frame[y1:y2, x1:x2]
            if face_region.size == 0:
                return "Unknown", 0.0
            faces = self.face_app.get(face_region)
            if not faces:
                return "Unknown", 0.0
            current_embedding = faces[0].embedding
            current_embedding = current_embedding / np.linalg.norm(current_embedding)
            similarities = cosine_similarity(self.student_embeddings, current_embedding.reshape(1, -1)).flatten()
            best_match_idx = np.argmax(similarities)
            best_similarity = similarities[best_match_idx]
            if best_similarity > 0.4:
                return self.student_names[best_match_idx], best_similarity
            else:
                return "Unknown", best_similarity
        except Exception:
            return "Unknown", 0.0

    def detect_eyes_closed(self, face_landmarks):
        if face_landmarks is None:
            return False
        left_eye_top = face_landmarks.landmark[159].y
        left_eye_bottom = face_landmarks.landmark[145].y
        left_eye_openness = abs(left_eye_bottom - left_eye_top)
        right_eye_top = face_landmarks.landmark[386].y
        right_eye_bottom = face_landmarks.landmark[374].y
        right_eye_openness = abs(right_eye_bottom - right_eye_top)
        return left_eye_openness < 0.01 and right_eye_openness < 0.01

    def detect_talking(self, face_landmarks):
        if face_landmarks is None:
            return False
        upper_lip = face_landmarks.landmark[13]
        lower_lip = face_landmarks.landmark[14]
        mouth_openness = abs(lower_lip.y - upper_lip.y)
        return mouth_openness > 0.05

    def run_yolo_detection(self, frame):
        if self.behavior_model is None:
            return []
        try:
            small_frame = cv2.resize(frame, (640, 480))
            results = self.behavior_model.predict(small_frame, verbose=False, conf=0.25, imgsz=320)[0]
            detected_objects = []
            for box in results.boxes:
                label = self.behavior_model.names[int(box.cls[0])].lower()
                bx1, by1, bx2, by2 = map(int, box.xyxy[0])
                scale_x = frame.shape[1] / 640
                scale_y = frame.shape[0] / 480
                bx1, bx2 = int(bx1 * scale_x), int(bx2 * scale_x)
                by1, by2 = int(by1 * scale_y), int(by2 * scale_y)
                detected_objects.append({'label': label, 'bbox': (bx1, by1, bx2, by2)})
            return detected_objects
        except Exception:
            return []

    def detect_behaviors(self, face_data, yolo_objects):
        x1, y1, x2, y2 = face_data['rect']
        behaviors = []
        if self.detect_talking(face_data['landmarks']):
            behaviors.append("Talking")
        if self.detect_eyes_closed(face_data['landmarks']):
            self.eye_closed_frames += 1
            if self.eye_closed_frames >= self.sleeping_threshold:
                behaviors.append("Sleeping")
        else:
            self.eye_closed_frames = 0
        for obj in yolo_objects:
            label = obj['label']
            if "cell" in label or "phone" in label:
                behaviors.append("Phone")
            if "bottle" in label or "cup" in label:
                behaviors.append("Drinking")
            if label in ["apple", "banana", "sandwich"]:
                behaviors.append("Eating")
        return list(set(behaviors))

    def run_camera(self):
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        if not cap.isOpened():
            return
        print("✓ Camera ready")
        print("Press 'q' to quit")

        frame_count = 0
        current_fps = 0
        fps_start_time = time.time()
        fps_frame_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_count += 1
            fps_frame_count += 1
            frame = cv2.flip(frame, 1)
            current_time = time.time()
            if current_time - fps_start_time >= 1.0:
                current_fps = fps_frame_count
                fps_frame_count = 0
                fps_start_time = current_time

            if frame_count % self.face_detection_interval == 0:
                faces = self.detect_faces_fast(frame)
                self.last_faces = faces
            else:
                faces = self.last_faces

            if frame_count % self.yolo_interval == 0:
                yolo_objects = self.run_yolo_detection(frame)
                self.last_yolo_results = yolo_objects
            else:
                yolo_objects = self.last_yolo_results

            for i, face_data in enumerate(faces):
                x1, y1, x2, y2 = face_data['rect']
                face_specific_objects = []
                for obj in yolo_objects:
                    bx1, by1, bx2, by2 = obj['bbox']
                    overlap = not (bx2 < x1 or bx1 > x2 or by2 < y1 or by1 > y2)
                    if overlap:
                        face_specific_objects.append(obj)

                if frame_count % self.recognition_interval == 0:
                    student_name, similarity = self.recognize_face_fast(frame, (x1, y1, x2, y2))
                    self.last_recognition[i] = (student_name, similarity)
                else:
                    student_name, similarity = self.last_recognition.get(i, ("Unknown", 0.0))

                behaviors = self.detect_behaviors(face_data, face_specific_objects)
                behavior_text = ", ".join(behaviors) if behaviors else "Normal"

                # ===== SEND TO TRACKIFY BACKEND =====
                for behavior in behaviors:
                    report_key = f"{student_name}_{behavior}"
                    if self.should_report(report_key):
                        if behavior == "Phone":
                            report_phone_detected(self.room_number, student_name)
                        else:
                            severity = "medium" if behavior == "Sleeping" else "low"
                            report_behavior_alert(self.room_number, behavior, student_name, severity)
                        print(f"📡 Reported: {student_name} - {behavior}")
                # =====================================

                color = (0, 255, 0) if student_name != "Unknown" else (0, 0, 255)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, student_name, (x1, y1-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                cv2.putText(frame, behavior_text, (x1, y2+20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)

            cv2.putText(frame, f"FPS: {current_fps}", (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.imshow("Trackify - Face Recognition", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    try:
        FastFaceRecognition()
    except Exception as e:
        print(f"Error: {e}")
`;

const PythonIntegrationCode = () => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pythonCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Python code copied to clipboard. Save as trackify.py and run it.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Python Integration Script</h4>
            <p className="text-sm text-muted-foreground">Copy & run locally: <code className="text-xs bg-secondary px-1 rounded">python trackify.py</code></p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Code
            </>
          )}
        </Button>
      </div>
      
      {isExpanded && (
        <div className="border-t border-border">
          <pre className="p-4 overflow-x-auto text-sm bg-secondary/30 max-h-96 overflow-y-auto">
            <code className="text-foreground font-mono whitespace-pre">{pythonCode}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default PythonIntegrationCode;
