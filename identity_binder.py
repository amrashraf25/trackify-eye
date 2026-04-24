"""
TRACKIFY — Identity Binder
Locks tracker_id → student_id mappings once attendance is confirmed.

Problem it solves:
  ByteTrack assigns a numeric track_id to each person bounding box.
  InsightFace may occasionally return a different name for the same
  physical person if they move, change angle, or are briefly occluded.

  Without locking, this causes:
    • Wrong attendance (person A mis-identified as B for a few frames)
    • Behavior events attributed to the wrong student
    • "Identity flipping" visible in the UI

Solution:
  Once the AttendanceBuffer confirms a student (after 3 s continuous
  presence), we lock that track_id → student_id for the rest of the
  session. Subsequent raw recognition results for that track_id are
  IGNORED — the confirmed identity is always used instead.

  If the track is lost (person leaves frame) for > GRACE_PERIOD seconds,
  the binding is released so the slot can be reused. When the same person
  re-enters, recognition runs again and a new binding is established.
"""

import threading
import time
import logging
from typing import Optional

log = logging.getLogger("trackify.identity_binder")

# Seconds a lost track is kept before its binding is released.
# Set high enough so brief occlusions don't reset the binding.
GRACE_PERIOD = 10.0


class IdentityBinder:
    """
    Thread-safe map: track_id (int) → student_id (str).

    Lifecycle per binding:
        unbound  ──(confirm)──►  bound  ──(grace expired)──►  released
                                   ↑                                │
                                   └────(seen again in time)────────┘

    Usage in AI pipeline:
        binder = IdentityBinder()

        # Each frame, for every confirmed track:
        student_id = binder.resolve(tid, raw_student_id, just_confirmed)

        # When a track disappears from PersonTracker:
        binder.track_lost(tid)

        # On session reset:
        binder.reset()
    """

    def __init__(self, grace_period: float = GRACE_PERIOD):
        self._grace        = grace_period
        self._lock         = threading.RLock()

        # track_id → student_id  (locked binding)
        self._bindings:    dict[int, str]   = {}

        # track_id → time the track was last seen (for grace period)
        self._last_seen:   dict[int, float] = {}

        # track_id → time the track was lost (to compute grace expiry)
        self._lost_at:     dict[int, float] = {}

    # ── Core method ───────────────────────────────────────────────────

    def resolve(
        self,
        track_id:       int,
        raw_student_id: Optional[str],
        just_confirmed: bool = False,
    ) -> Optional[str]:
        """
        Returns the stable student_id to use for this track_id this frame.

        Rules:
          1. If already bound → return bound identity (ignore raw).
          2. If just_confirmed and not yet bound → lock the binding now.
          3. If not bound and not confirmed → return raw_student_id as-is.

        Args:
            track_id:       Numeric ID from PersonTracker.
            raw_student_id: What InsightFace returned this frame (may be None).
            just_confirmed: True on the exact frame AttendanceBuffer confirms.

        Returns:
            Stable student_id string, or None/raw if unknown.
        """
        now = time.monotonic()
        with self._lock:
            # Mark this track as seen (clears lost_at if it was lost)
            self._last_seen[track_id] = now
            self._lost_at.pop(track_id, None)

            # Binding already exists → always use it
            if track_id in self._bindings:
                return self._bindings[track_id]

            # Lock binding on confirmation
            if just_confirmed and raw_student_id and raw_student_id != "Unknown":
                self._bindings[track_id] = raw_student_id
                log.info(
                    "[IdentityBinder] Locked track %d → %s",
                    track_id, raw_student_id
                )
                return raw_student_id

            # Not bound yet → use raw result as-is
            return raw_student_id

    # ── Track lifecycle ───────────────────────────────────────────────

    def track_lost(self, track_id: int):
        """
        Called when PersonTracker removes a track (person left frame).
        Starts the grace period countdown.
        After GRACE_PERIOD seconds without `resolve()`, binding is released.
        """
        with self._lock:
            if track_id in self._bindings:
                self._lost_at[track_id] = time.monotonic()
                log.debug("[IdentityBinder] Track %d lost, grace period started", track_id)

    def expire_grace_periods(self):
        """
        Call this periodically (e.g. every frame) to release bindings
        whose grace periods have expired.
        Should be called from the AI worker thread.
        """
        now = time.monotonic()
        with self._lock:
            expired = [
                tid for tid, t in self._lost_at.items()
                if (now - t) > self._grace
            ]
            for tid in expired:
                student_id = self._bindings.pop(tid, None)
                self._lost_at.pop(tid, None)
                self._last_seen.pop(tid, None)
                if student_id:
                    log.debug(
                        "[IdentityBinder] Released binding track %d → %s (grace expired)",
                        tid, student_id
                    )

    # ── Queries ───────────────────────────────────────────────────────

    def get_bound_student(self, track_id: int) -> Optional[str]:
        """Returns the locked student_id for this track, or None."""
        with self._lock:
            return self._bindings.get(track_id)

    def is_bound(self, track_id: int) -> bool:
        with self._lock:
            return track_id in self._bindings

    def bound_count(self) -> int:
        with self._lock:
            return len(self._bindings)

    def all_bindings(self) -> dict:
        with self._lock:
            return dict(self._bindings)

    # ── Reset ─────────────────────────────────────────────────────────

    def reset(self):
        """Clear all bindings. Call on session reset."""
        with self._lock:
            count = len(self._bindings)
            self._bindings.clear()
            self._last_seen.clear()
            self._lost_at.clear()
        log.info("[IdentityBinder] Reset — released %d bindings", count)
