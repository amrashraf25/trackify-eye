"""
╔══════════════════════════════════════════════════════════════════════╗
║  counting.py — Smart Classroom Counter & Attendance Tracker          ║
║                                                                      ║
║  Three-layer design:                                                 ║
║    RecognitionVoter   → stabilise flickering face IDs per track      ║
║    AttendanceBuffer   → confirm attendance only after N seconds      ║
║    ClassroomCounter   → combines both; produces classroom snapshot   ║
║                                                                      ║
║  Key ideas re-implemented (NOT copied) from counting literature:    ║
║    • Use stable tracker IDs — never count same person twice          ║
║    • Sliding-window vote: 7/10 frames must agree on a name           ║
║    • Time-based confirmation: 3 s of continuous presence required    ║
║    • Gap tolerance: brief occlusion (< 1 s) does not reset streak    ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import time
from collections import defaultdict, deque
from typing import Dict, List, Optional, Set


# ════════════════════════════════════════════════════════════════════════
#  LAYER 1 — Recognition Voter
# ════════════════════════════════════════════════════════════════════════

class RecognitionVoter:
    """
    Per-track sliding-window majority vote over the last `window` frames.

    Problem it solves
    ─────────────────
    InsightFace sometimes flickers between a real name and "Unknown"
    because lighting changes or brief occlusions lower the similarity
    score below the threshold.

    Solution
    ────────
    Keep a fixed-length deque of raw recognitions per track.
    Only return a name if it appears in ≥ threshold fraction of the window.
    Otherwise return "Unknown".

    Example (window=10, threshold=0.6):
      Buffer: [Ahmed, Unknown, Ahmed, Ahmed, Unknown, Ahmed, Ahmed, Unknown, Ahmed, Ahmed]
      Ahmed appears 7/10 times → vote() returns "Ahmed"
    """

    def __init__(self, window: int = 10, threshold: float = 0.6):
        self.window    = window
        self.threshold = threshold
        self._bufs: Dict[int, deque] = {}

    def vote(self, track_id: int, name: str, confidence: float,
             min_confidence: float = 0.25) -> str:
        """
        Submit one recognition result and return the consensus name.

        Parameters
        ──────────
          track_id       stable ID from PersonTracker
          name           raw name from InsightFace (may be "Unknown")
          confidence     cosine similarity from InsightFace
          min_confidence below this → force "Unknown" before voting

        Returns
        ───────
          Voted name — a real name or "Unknown"
        """
        # Treat low-confidence hits as Unknown before they enter the vote
        effective = name if confidence >= min_confidence else "Unknown"

        if track_id not in self._bufs:
            self._bufs[track_id] = deque(maxlen=self.window)
        self._bufs[track_id].append(effective)

        buf    = self._bufs[track_id]
        counts: Dict[str, int] = defaultdict(int)
        for n in buf:
            counts[n] += 1

        # Find the name with the most votes (excluding Unknown if possible)
        candidates = [(n, c) for n, c in counts.items() if n != "Unknown"]
        if candidates:
            best_name, best_count = max(candidates, key=lambda x: x[1])
            if best_count / len(buf) >= self.threshold:
                return best_name

        return "Unknown"

    def clear_track(self, track_id: int):
        """Call when a track is permanently removed."""
        self._bufs.pop(track_id, None)

    def reset(self):
        self._bufs.clear()


# ════════════════════════════════════════════════════════════════════════
#  LAYER 2 — Attendance Buffer
# ════════════════════════════════════════════════════════════════════════

class AttendanceBuffer:
    """
    Mark a student as present only after they have been continuously
    detected for at least `confirm_seconds`.

    Design choices
    ──────────────
    • A gap of up to `gap_tolerance` seconds does NOT reset the streak.
      (Student briefly turns away or tracker loses them for one second.)
    • Once confirmed, attendance is sticky for the whole session.
    • confirmed is a set — no duplicate entries possible.

    Usage
    ─────
      buf = AttendanceBuffer(confirm_seconds=3.0)
      buf.update("Ahmed")   # returns True the first time Ahmed is confirmed
      buf.update("Ahmed")   # returns False (already confirmed)
      buf.snapshot_absent(["Ahmed", "Sara", "Walid"])  # → ["Sara", "Walid"]
    """

    def __init__(self, confirm_seconds: float = 3.0, gap_tolerance: float = 1.5):
        self.confirm_seconds = confirm_seconds
        self.gap_tolerance   = gap_tolerance

        self._first_seen: Dict[str, float] = {}   # name → streak start time
        self._last_seen:  Dict[str, float] = {}   # name → last seen time
        self.confirmed:   Set[str]         = set()

    def update(self, name: str) -> bool:
        """
        Notify that `name` was detected this frame.
        Returns True exactly once — the moment attendance is first confirmed.
        """
        if not name or name == "Unknown":
            return False

        now = time.time()

        # If there was a gap, restart the streak
        if name in self._last_seen:
            gap = now - self._last_seen[name]
            if gap > self.gap_tolerance:
                del self._first_seen[name]

        if name not in self._first_seen:
            self._first_seen[name] = now

        self._last_seen[name] = now

        # Confirm when streak duration reaches threshold
        if name not in self.confirmed:
            if now - self._first_seen[name] >= self.confirm_seconds:
                self.confirmed.add(name)
                return True

        return False

    def streak_progress(self, name: str) -> float:
        """
        Returns 0.0–1.0 showing how close a student is to being confirmed.
        Useful for drawing a progress bar on the video overlay.
        """
        if name in self.confirmed:
            return 1.0
        if name not in self._first_seen:
            return 0.0
        elapsed = time.time() - self._first_seen[name]
        return min(1.0, elapsed / self.confirm_seconds)

    def snapshot_absent(self, registered: List[str]) -> List[str]:
        """Names in `registered` that have NOT been confirmed yet."""
        return sorted(r for r in registered if r not in self.confirmed)

    def reset_session(self):
        """Clear all state for a new session."""
        self._first_seen.clear()
        self._last_seen.clear()
        self.confirmed.clear()


# ════════════════════════════════════════════════════════════════════════
#  LAYER 3 — Classroom Counter  (main public class)
# ════════════════════════════════════════════════════════════════════════

class ClassroomCounter:
    """
    Orchestrates voting + attendance into a coherent classroom snapshot.

    Answers questions like:
      • How many people are in the room right now?
      • Which registered students have been confirmed present?
      • Which are absent?
      • How many unrecognised faces are in frame?
      • What is the overall attendance rate?

    Usage
    ─────
      counter = ClassroomCounter(registered_students=["Ahmed", "Sara"])

      # Each frame, for each confirmed track:
      stable = counter.update(track_id, raw_name, confidence)
      # stable is the voted name — use it for behavior labelling too

      # When a track disappears:
      counter.remove_track(track_id)

      # Any time you need the full picture:
      snap = counter.snapshot()
      # → {
      #     "present_confirmed": ["Ahmed"],
      #     "present_in_frame":  ["Ahmed"],
      #     "absent":            ["Sara"],
      #     "unknown_in_frame":  1,
      #     "total_in_frame":    2,
      #     "total_registered":  2,
      #     "attendance_rate":   0.50,
      #     "newly_confirmed":   []
      #   }
    """

    def __init__(
        self,
        registered_students: Optional[List[str]] = None,
        confirm_seconds:  float = 3.0,
        gap_tolerance:    float = 1.5,
        vote_window:      int   = 10,
        vote_threshold:   float = 0.6,
        min_confidence:   float = 0.25,
    ):
        self.registered       = list(registered_students or [])
        self.min_confidence   = min_confidence

        self._voter   = RecognitionVoter(window=vote_window, threshold=vote_threshold)
        self._attend  = AttendanceBuffer(confirm_seconds, gap_tolerance)

        # track_id → latest voted name
        self._active: Dict[int, str] = {}

        # names confirmed this update cycle (flushed after each snapshot call)
        self._newly_confirmed: List[str] = []

    # ── Public API ──────────────────────────────────────────────────────

    def set_registered(self, names: List[str]):
        """Update the registered student list after a reload."""
        self.registered = list(names)

    def update(self, track_id: int, raw_name: str, confidence: float) -> str:
        """
        Process one (track_id, recognition_result) pair per frame.

        Returns
        ───────
          Stabilised name — use this for behaviour labelling and drawing.
        """
        stable, _ = self.update_with_confirm(track_id, raw_name, confidence)
        return stable

    def update_with_confirm(self, track_id: int, raw_name: str, confidence: float):
        """
        Like update() but also returns whether attendance was just confirmed.

        Returns
        ───────
          (stable_name: str, just_confirmed: bool)
          just_confirmed is True only on the very first frame attendance is locked in.
        """
        stable = self._voter.vote(track_id, raw_name, confidence, self.min_confidence)
        self._active[track_id] = stable

        just_confirmed = self._attend.update(stable)
        if just_confirmed:
            self._newly_confirmed.append(stable)

        return stable, just_confirmed

    def remove_track(self, track_id: int):
        """
        Call when PersonTracker deletes a track.
        Clears voting buffer for that ID (avoids stale state if the ID
        is ever reused in the same session).
        """
        self._voter.clear_track(track_id)
        self._active.pop(track_id, None)

    def streak_progress(self, name: str) -> float:
        """0.0–1.0 — how close `name` is to confirmed attendance."""
        return self._attend.streak_progress(name)

    def snapshot(self) -> dict:
        """
        Full classroom state at this instant.

        Keys
        ────
          present_confirmed  students whose attendance is locked in
          present_in_frame   students currently visible (voted name ≠ Unknown)
          absent             registered students not yet confirmed
          unknown_in_frame   count of unrecognised faces in current frame
          total_in_frame     total tracks in current frame
          total_registered   size of registered student list
          attendance_rate    confirmed / registered  (0.0–1.0)
          newly_confirmed    names confirmed since last snapshot() call
        """
        confirmed    = sorted(self._attend.confirmed)
        in_frame     = sorted({n for n in self._active.values() if n != "Unknown"})
        absent       = self._attend.snapshot_absent(self.registered)
        unknown      = sum(1 for n in self._active.values() if n == "Unknown")
        total_det    = len(self._active)
        total_reg    = len(self.registered)
        rate         = len(confirmed) / total_reg if total_reg > 0 else 0.0

        newly        = list(self._newly_confirmed)
        self._newly_confirmed.clear()

        return {
            "present_confirmed": confirmed,
            "present_in_frame":  in_frame,
            "absent":            absent,
            "unknown_in_frame":  unknown,
            "total_in_frame":    total_det,
            "total_registered":  total_reg,
            "attendance_rate":   round(rate, 2),
            "newly_confirmed":   newly,
        }

    def reset_session(self):
        """Start a brand-new monitoring session."""
        self._attend.reset_session()
        self._voter.reset()
        self._active.clear()
        self._newly_confirmed.clear()

    # ── Convenience properties ──────────────────────────────────────────

    @property
    def confirmed_count(self) -> int:
        return len(self._attend.confirmed)

    @property
    def unknown_count(self) -> int:
        return sum(1 for n in self._active.values() if n == "Unknown")

    @property
    def total_in_frame(self) -> int:
        return len(self._active)
