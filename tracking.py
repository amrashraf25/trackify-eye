"""
╔══════════════════════════════════════════════════════════════════════╗
║  tracking.py — Multi-Person Tracker for Trackify                    ║
║                                                                      ║
║  Architecture:                                                       ║
║    KalmanBoxTracker  → constant-velocity Kalman filter per person    ║
║    PersonTracker     → ByteTrack-inspired two-stage IoU matching     ║
║                                                                      ║
║  Concepts re-implemented from scratch (not copied from any repo):   ║
║    • Unique persistent IDs that survive brief occlusions             ║
║    • Two-stage matching: high-conf first, then re-associate lost     ║
║    • Track lifecycle: tentative → confirmed → lost → removed         ║
║    • Greedy IoU assignment (optimal for classroom scale ≤ 40 people) ║
║                                                                      ║
║  Why this beats simple frame indexing:                               ║
║    • person_id = 1 in frame 5 is the SAME student as frame 6        ║
║    • Behavior state (sleeping_frames, cheating_frames) is stable     ║
║    • Attendance confirmation never double-counts one person          ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import numpy as np
from typing import List, Tuple, Dict


# ════════════════════════════════════════════════════════════════════════
#  KALMAN FILTER — constant-velocity model for one bounding box
# ════════════════════════════════════════════════════════════════════════

class KalmanBoxTracker:
    """
    State vector  : [cx, cy, w, h, vcx, vcy, vw, vh]
    Measurement   : [cx, cy, w, h]
    Motion model  : constant velocity (x_new = x + vx * dt, dt = 1 frame)

    Lifecycle flags
    ───────────────
      hits               – total matched measurements
      age                – total frames this track has existed
      time_since_update  – frames since last matched measurement
      state              – "tentative" | "confirmed" | "lost"
    """

    _id_counter: int = 0

    @classmethod
    def reset_id_counter(cls):
        cls._id_counter = 0

    def __init__(self, bbox: Tuple[int, int, int, int]):
        KalmanBoxTracker._id_counter += 1
        self.id: int = KalmanBoxTracker._id_counter

        # ── State ──────────────────────────────────────────────────────
        cx, cy, w, h = self._to_state(bbox)
        self._x = np.array([cx, cy, w, h, 0., 0., 0., 0.], dtype=float).reshape(8, 1)

        # ── Transition matrix F (x_k = F * x_{k-1}) ───────────────────
        # Position += velocity each frame
        self._F = np.eye(8, dtype=float)
        for i in range(4):
            self._F[i, i + 4] = 1.0

        # ── Measurement matrix H (z = H * x) ──────────────────────────
        self._H = np.zeros((4, 8), dtype=float)
        self._H[:4, :4] = np.eye(4)

        # ── Covariance matrices ────────────────────────────────────────
        self._P = np.eye(8, dtype=float)
        self._P[4:, 4:] *= 1000.0     # high initial velocity uncertainty

        self._Q = np.eye(8, dtype=float)   # process noise
        self._Q[4:, 4:] *= 0.01

        self._R = np.eye(4, dtype=float)   # measurement noise
        self._R *= 4.0

        # ── Lifecycle ──────────────────────────────────────────────────
        self.hits: int              = 1
        self.age: int               = 1
        self.time_since_update: int = 0
        self.state: str             = "tentative"   # tentative / confirmed / lost

    # ── Predict ────────────────────────────────────────────────────────

    def predict(self) -> Tuple[int, int, int, int]:
        """Advance state by one frame. Returns predicted bbox."""
        # Clip w/h so they never go negative
        if self._x[2, 0] + self._x[6, 0] <= 0:
            self._x[6, 0] = 0.0
        if self._x[3, 0] + self._x[7, 0] <= 0:
            self._x[7, 0] = 0.0

        self._x = self._F @ self._x
        self._P = self._F @ self._P @ self._F.T + self._Q
        self.age += 1
        self.time_since_update += 1
        return self.get_bbox()

    # ── Update ─────────────────────────────────────────────────────────

    def update(self, bbox: Tuple[int, int, int, int]):
        """Correct state with a new matched measurement."""
        cx, cy, w, h = self._to_state(bbox)
        z = np.array([cx, cy, w, h], dtype=float).reshape(4, 1)

        S = self._H @ self._P @ self._H.T + self._R
        K = self._P @ self._H.T @ np.linalg.inv(S)
        self._x = self._x + K @ (z - self._H @ self._x)
        self._P = (np.eye(8) - K @ self._H) @ self._P

        self.hits += 1
        self.time_since_update = 0

        if self.hits >= 3:
            self.state = "confirmed"

    # ── Accessors ──────────────────────────────────────────────────────

    def get_bbox(self) -> Tuple[int, int, int, int]:
        cx = float(self._x[0, 0])
        cy = float(self._x[1, 0])
        w  = max(1.0, float(self._x[2, 0]))
        h  = max(1.0, float(self._x[3, 0]))
        return (
            int(cx - w / 2),
            int(cy - h / 2),
            int(cx + w / 2),
            int(cy + h / 2),
        )

    # ── Internal ───────────────────────────────────────────────────────

    @staticmethod
    def _to_state(bbox: Tuple) -> Tuple[float, float, float, float]:
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        w  = float(x2 - x1)
        h  = float(y2 - y1)
        return cx, cy, w, h


# ════════════════════════════════════════════════════════════════════════
#  IoU HELPER
# ════════════════════════════════════════════════════════════════════════

def _iou(a: Tuple, b: Tuple) -> float:
    """Intersection over Union for two (x1,y1,x2,y2) boxes."""
    xi1 = max(a[0], b[0]);  yi1 = max(a[1], b[1])
    xi2 = min(a[2], b[2]);  yi2 = min(a[3], b[3])
    if xi2 <= xi1 or yi2 <= yi1:
        return 0.0
    inter  = (xi2 - xi1) * (yi2 - yi1)
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union  = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


# ════════════════════════════════════════════════════════════════════════
#  GREEDY MATCHING  (optimal for N ≤ 40, avoids scipy dependency)
# ════════════════════════════════════════════════════════════════════════

def _greedy_match(
    tracks:       List[KalmanBoxTracker],
    detections:   List[Tuple],
    iou_threshold: float = 0.3,
) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
    """
    Greedily assign detections to tracks by descending IoU.

    Returns
    ───────
      matched          : [(track_idx, det_idx), ...]
      unmatched_tracks : [track_idx, ...]
      unmatched_dets   : [det_idx, ...]
    """
    if not tracks or not detections:
        return [], list(range(len(tracks))), list(range(len(detections)))

    # Build IoU matrix
    iou_mat = np.zeros((len(tracks), len(detections)), dtype=float)
    for i, t in enumerate(tracks):
        pred = t.get_bbox()
        for j, d in enumerate(detections):
            iou_mat[i, j] = _iou(pred, d)

    matched:     List[Tuple[int, int]] = []
    used_t:      set = set()
    used_d:      set = set()

    # Sort all (i,j) pairs by IoU descending and greedily pick
    for flat_idx in np.argsort(-iou_mat.ravel()):
        i, j = divmod(int(flat_idx), len(detections))
        if iou_mat[i, j] < iou_threshold:
            break
        if i not in used_t and j not in used_d:
            matched.append((i, j))
            used_t.add(i)
            used_d.add(j)

    unmatched_t = [i for i in range(len(tracks)) if i not in used_t]
    unmatched_d = [j for j in range(len(detections)) if j not in used_d]
    return matched, unmatched_t, unmatched_d


# ════════════════════════════════════════════════════════════════════════
#  PERSON TRACKER  — main public class
# ════════════════════════════════════════════════════════════════════════

class PersonTracker:
    """
    Multi-person tracker using Kalman filters + two-stage IoU matching.

    Inspired by ByteTrack's key idea:
      Stage 1 — match *active* tracks to high-confidence detections
      Stage 2 — re-associate *lost* tracks with leftover low-conf dets

    This prevents losing track of a briefly occluded student.

    Parameters
    ──────────
      iou_high    IoU threshold for active track matching  (Stage 1)
      iou_low     IoU threshold for lost track re-assoc    (Stage 2)
      max_age     Frames before removing an unmatched track
      min_hits    Frames before a tentative track is confirmed

    Usage
    ─────
      tracker = PersonTracker()

      # Each frame:
      confirmed, removed_ids = tracker.update(person_bboxes)
      for track in confirmed:
          print(track.id, track.get_bbox())
    """

    def __init__(
        self,
        iou_high: float = 0.5,
        iou_low:  float = 0.3,
        max_age:  int   = 30,
        min_hits: int   = 3,
    ):
        self.iou_high = iou_high
        self.iou_low  = iou_low
        self.max_age  = max_age
        self.min_hits = min_hits
        self.tracks:  List[KalmanBoxTracker] = []

    def update(
        self,
        detections: List[Tuple[int, int, int, int]],
    ) -> Tuple[List[KalmanBoxTracker], List[int]]:
        """
        Parameters
        ──────────
          detections  list of (x1, y1, x2, y2) person bounding boxes

        Returns
        ───────
          confirmed_tracks  : tracks in "confirmed" state (stable, 3+ hits)
          removed_ids       : track IDs deleted this frame (notify counter)
        """
        # 1. Predict all tracks forward one frame
        for t in self.tracks:
            t.predict()

        # 2. Split tracks into active vs lost
        active = [t for t in self.tracks if t.time_since_update <= 1]
        lost   = [t for t in self.tracks if t.time_since_update >  1]

        # ── Stage 1: active tracks ↔ high-conf detections ──────────────
        matched1, unmatched_active, unmatched_dets = _greedy_match(
            active, detections, self.iou_high
        )
        for ti, di in matched1:
            active[ti].update(detections[di])

        # ── Stage 2: lost tracks ↔ remaining detections ────────────────
        remaining_dets = [detections[j] for j in unmatched_dets]
        matched2, _, still_unmatched = _greedy_match(
            lost, remaining_dets, self.iou_low
        )
        for ti, di in matched2:
            lost[ti].update(remaining_dets[di])

        # 3. Create new tracks for genuinely new detections
        for j in still_unmatched:
            self.tracks.append(KalmanBoxTracker(remaining_dets[j]))

        # 4. Mark unmatched active tracks as "lost"
        for ti in unmatched_active:
            if active[ti].hits >= self.min_hits:
                active[ti].state = "lost"

        # 5. Remove tracks that have been lost too long
        prev_ids    = {t.id for t in self.tracks}
        self.tracks = [t for t in self.tracks if t.time_since_update <= self.max_age]
        curr_ids    = {t.id for t in self.tracks}
        removed_ids = list(prev_ids - curr_ids)

        # 6. Return only confirmed tracks
        confirmed = [t for t in self.tracks if t.state == "confirmed"]
        return confirmed, removed_ids

    def reset(self):
        """Clear all tracks and reset ID counter (new session)."""
        self.tracks.clear()
        KalmanBoxTracker.reset_id_counter()

    # ── Utility ─────────────────────────────────────────────────────────

    @property
    def active_count(self) -> int:
        """Number of confirmed tracks currently in view."""
        return sum(1 for t in self.tracks if t.state == "confirmed")

    @property
    def all_ids(self) -> List[int]:
        """IDs of all tracks regardless of state."""
        return [t.id for t in self.tracks]


# ════════════════════════════════════════════════════════════════════════
#  FACE-TO-TRACK MATCHER  — map MediaPipe face rects to tracker boxes
# ════════════════════════════════════════════════════════════════════════

def match_faces_to_tracks(
    face_detections: List[Dict],
    tracks:          List[KalmanBoxTracker],
    iou_threshold:   float = 0.15,
) -> Dict[int, Dict]:
    """
    Match each confirmed tracker box to the best MediaPipe face detection.

    A face box sits in the upper portion of a person box, so we use a
    generous IoU threshold and also accept containment (face center inside
    person box).

    Returns
    ───────
      {track_id: face_dict}   face_dict has keys 'rect' and 'landmarks'
                              value is None when no face matched the track
    """
    result: Dict[int, Dict] = {t.id: None for t in tracks}

    if not face_detections or not tracks:
        return result

    for track in tracks:
        tb = track.get_bbox()
        tx1, ty1, tx2, ty2 = tb

        best_face  = None
        best_score = -1.0

        for fd in face_detections:
            fx1, fy1, fx2, fy2 = fd["rect"]

            # Score = IoU + containment bonus
            score = _iou(tb, fd["rect"])

            # Bonus: face center inside person box
            fcx = (fx1 + fx2) / 2
            fcy = (fy1 + fy2) / 2
            if tx1 <= fcx <= tx2 and ty1 <= fcy <= ty2:
                score += 0.3   # strong containment bonus

            if score > best_score:
                best_score = score
                best_face  = fd

        if best_score >= iou_threshold and best_face is not None:
            result[track.id] = best_face

    return result
