import math

class BehaviorDetection:

    def __init__(self):
        self._cheating_frames = 0
        self._talking_frames = 0
        self._fighting_frames = 0
        self.eye_closed_frames = 0
        self.sleeping_threshold = 10

    # ── CHEATING DETECTION ─────────────────────────────
    def detect_cheating(self, face_landmarks):
        if face_landmarks is None:
            self._cheating_frames = max(0, self._cheating_frames - 1)
            return self._cheating_frames >= 18

        nose = face_landmarks.landmark[1]
        left_eye = face_landmarks.landmark[33]
        right_eye = face_landmarks.landmark[263]

        eye_width = abs(right_eye.x - left_eye.x)

        if eye_width < 0.03:
            self._cheating_frames = max(0, self._cheating_frames - 2)
            return self._cheating_frames >= 18

        eye_mid_x = (left_eye.x + right_eye.x) / 2
        offset_ratio = abs(nose.x - eye_mid_x) / eye_width

        if offset_ratio > 0.42:
            self._cheating_frames += 1
        else:
            self._cheating_frames = max(0, self._cheating_frames - 2)

        return self._cheating_frames >= 18


    # ── HEAD DROOPING (DROWSY) ─────────────────────────
    def detect_head_drooping(self, face_landmarks):
        if face_landmarks is None:
            return False

        forehead = face_landmarks.landmark[10]
        nose = face_landmarks.landmark[1]
        chin = face_landmarks.landmark[152]

        face_h = abs(chin.y - forehead.y)
        if face_h < 0.01:
            return False

        return (chin.y - nose.y) / face_h < 0.22


    # ── FIGHTING DETECTION ─────────────────────────────
    def detect_fighting(self, person_boxes):
        valid = [
            (x1, y1, x2, y2) for x1, y1, x2, y2 in person_boxes
            if (x2 - x1) > 50 and (y2 - y1) > 80
        ]

        close = False

        if len(valid) >= 2:
            for i in range(len(valid)):
                for j in range(i + 1, len(valid)):
                    x1a, y1a, x2a, y2a = valid[i]
                    x1b, y1b, x2b, y2b = valid[j]

                    # skip nested boxes
                    if (x1a >= x1b and x2a <= x2b and y1a >= y1b and y2a <= y2b):
                        continue
                    if (x1b >= x1a and x2b <= x2a and y1b >= y1a and y2b <= y2a):
                        continue

                    xi1, yi1 = max(x1a, x1b), max(y1a, y1b)
                    xi2, yi2 = min(x2a, x2b), min(y2a, y2b)

                    if xi2 > xi1 and yi2 > yi1:
                        inter = (xi2 - xi1) * (yi2 - yi1)

                        area_a = (x2a - x1a) * (y2a - y1a)
                        area_b = (x2b - x1b) * (y2b - y1b)
                        a_min = min(area_a, area_b)

                        if a_min > 0 and inter / a_min > 0.45:
                            close = True

        if close:
            self._fighting_frames = min(self._fighting_frames + 1, 20)
        else:
            self._fighting_frames = max(0, self._fighting_frames - 1)

        return self._fighting_frames >= 8


    # ── EYES CLOSED ────────────────────────────────────
    def detect_eyes_closed(self, face_landmarks):
        if face_landmarks is None:
            return False

        left_eye_top = face_landmarks.landmark[159].y
        left_eye_bottom = face_landmarks.landmark[145].y

        right_eye_top = face_landmarks.landmark[386].y
        right_eye_bottom = face_landmarks.landmark[374].y

        left_open = abs(left_eye_bottom - left_eye_top)
        right_open = abs(right_eye_bottom - right_eye_top)

        return left_open < 0.01 and right_open < 0.01


    # ── TALKING DETECTION ──────────────────────────────
    def detect_talking(self, face_landmarks):
        if face_landmarks is None:
            self._talking_frames = max(0, self._talking_frames - 1)
            return self._talking_frames >= 5

        upper_lip = face_landmarks.landmark[13]
        lower_lip = face_landmarks.landmark[14]
        left_mouth = face_landmarks.landmark[61]
        right_mouth = face_landmarks.landmark[291]

        mouth_h = abs(lower_lip.y - upper_lip.y)
        mouth_w = abs(right_mouth.x - left_mouth.x)

        mar = (mouth_h / mouth_w) if mouth_w > 0.001 else 0.0

        if mar > 0.18:
            self._talking_frames += 2
        elif mar > 0.10:
            self._talking_frames += 1
        else:
            self._talking_frames = max(0, self._talking_frames - 2)

        self._talking_frames = min(self._talking_frames, 20)

        return self._talking_frames >= 3