"""
TRACKIFY — Event Dispatcher (v2 — session-aware)

Sends attendance and behavior events from the AI pipeline to the backend.
Every event now carries the full context required by the backend:
    session_id, course_id, student_id, timestamp, type, behavior

Design:
  • Events are queued in a thread-safe deque.
  • Flushed every FLUSH_INTERVAL seconds as a single batch POST.
  • Attendance: one event per (student_id, session_id) — deduped in-memory.
  • Behaviors:  per-type cooldown per (student_id, behavior_type, session_id).
  • Active session + course polled from backend every SESSION_POLL_INTERVAL s.
  • On failure: exponential backoff up to MAX_RETRIES, then drop batch.
"""

import threading
import time
import logging
from collections import deque
from datetime import datetime, timezone

try:
    import requests
    _requests_ok = True
except ImportError:
    _requests_ok = False

log = logging.getLogger("trackify.dispatcher")

BACKEND_URL           = "http://localhost:3001"
API_KEY               = "local-anon-key"
FLUSH_INTERVAL        = 2.0    # seconds between batch flushes
SESSION_POLL_INTERVAL = 8.0    # seconds between session status polls (was 20 — too slow)
MAX_BATCH_SIZE        = 40
MAX_RETRIES           = 3
RETRY_BASE_DELAY      = 1.0

# Per-behavior minimum gap before a new event is queued (seconds)
BEHAVIOR_COOLDOWN: dict[str, float] = {
    "phone":    25.0,
    "sleeping": 55.0,
    "talking":  15.0,
    "fighting":  4.0,
    "cheating": 40.0,
    "drowsy":   25.0,
}

HEADERS = {
    "Content-Type":  "application/json",
    "apikey":        API_KEY,
    "Authorization": f"Bearer {API_KEY}",
}


class EventDispatcher:
    """
    Thread-safe event queue that periodically flushes to the backend.

    Public interface:
        dispatcher.push_attendance(student_id, confidence)
        dispatcher.push_behavior(student_id, behavior_type, confidence, duration_sec)
        dispatcher.set_session(session_id, course_id)   ← called by pipeline when session changes
        dispatcher.reset_session()
        dispatcher.start() / dispatcher.stop()
    """

    def __init__(self):
        self._queue:   deque = deque(maxlen=500)
        self._lock:    threading.RLock = threading.RLock()
        self._running: bool = False
        self._thread:  threading.Thread | None = None

        # ── Session context ───────────────────────────────────────────
        self._session_id:       str | None = None
        self._course_id:        str | None = None
        self._session_polled_at: float = 0.0

        # ── Dedup state ───────────────────────────────────────────────
        # Attendance: {(student_id, session_id)} already sent
        self._attendance_sent: set[tuple[str, str]] = set()

        # Behavior: {(student_id, behavior_type, session_id): last_sent_monotonic}
        self._behavior_last:   dict[tuple, float] = {}

    # ── Session context ───────────────────────────────────────────────

    def set_session(self, session_id: str | None, course_id: str | None):
        """
        Called by the AI pipeline when it knows the active session.
        StudentFilter.refresh() provides this info.
        """
        with self._lock:
            changed = (session_id != self._session_id)
            self._session_id = session_id
            self._course_id  = course_id
            if changed:
                log.info("[Dispatcher] Session set: %s (course: %s)", session_id, course_id)

    def get_session_id(self) -> str | None:
        with self._lock:
            return self._session_id

    # ── Public push methods ───────────────────────────────────────────

    def push_attendance(self, student_id: str, confidence: float = 0.0):
        """
        Queue one attendance confirmation.
        Deduped per (student_id, session_id) — safe to call every frame.
        Silently dropped if no active session is known yet.
        """
        with self._lock:
            if not self._session_id:
                return   # no session → backend would reject anyway; skip the queue
            sid = self._session_id
            key = (student_id, sid)
            if key in self._attendance_sent:
                return
            self._attendance_sent.add(key)
            course_id  = self._course_id
            session_id = self._session_id

        self._enqueue({
            "type":       "attendance",
            "student_id": student_id,
            "session_id": session_id,
            "course_id":  course_id,
            "confidence": round(confidence, 4),
            "timestamp":  _utcnow(),
        })
        log.debug("[Dispatcher] Attendance queued: %s conf=%.2f", student_id, confidence)

    def push_behavior(
        self,
        student_id:   str,
        behavior_type: str,
        confidence:   float = 0.0,
        duration_sec: float = 0.0,
    ):
        """
        Queue one behavior event.
        Respects per-type cooldown to avoid flooding.
        """
        now = time.monotonic()
        cd  = BEHAVIOR_COOLDOWN.get(behavior_type, 20.0)

        with self._lock:
            if not self._session_id:
                return   # no session → silently drop
            sid = self._session_id
            key = (student_id, behavior_type, sid)
            if now - self._behavior_last.get(key, 0.0) < cd:
                return
            self._behavior_last[key] = now
            course_id  = self._course_id
            session_id = self._session_id

        self._enqueue({
            "type":          "behavior",
            "student_id":    student_id,
            "session_id":    session_id,
            "course_id":     course_id,
            "behavior_type": behavior_type,
            "confidence":    round(confidence, 4),
            "duration_sec":  round(duration_sec, 2),
            "timestamp":     _utcnow(),
        })
        log.debug("[Dispatcher] Behavior queued: %s → %s", student_id, behavior_type)

    def reset_session(self):
        """Call on camera Stop / new session start."""
        with self._lock:
            self._attendance_sent.clear()
            self._behavior_last.clear()
            self._session_id      = None
            self._course_id       = None
            self._session_polled_at = 0.0
        log.info("[Dispatcher] Session reset")

    # ── Lifecycle ─────────────────────────────────────────────────────

    def start(self):
        self._running = True
        self._thread  = threading.Thread(
            target=self._flush_loop, daemon=True, name="EventDispatcher"
        )
        self._thread.start()
        log.info("[Dispatcher] Started — flush every %.1fs", FLUSH_INTERVAL)

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=6)
        log.info("[Dispatcher] Stopped")

    # ── Internal ──────────────────────────────────────────────────────

    def _enqueue(self, event: dict):
        with self._lock:
            self._queue.append(event)

    def _flush_loop(self):
        while self._running:
            time.sleep(FLUSH_INTERVAL)
            self._maybe_poll_session()
            try:
                self._flush()
            except Exception as e:
                log.warning("[Dispatcher] Flush error: %s", e)

    def _maybe_poll_session(self):
        """Periodically fetch the active session from backend."""
        if not _requests_ok:
            return
        now = time.monotonic()
        with self._lock:
            if now - self._session_polled_at < SESSION_POLL_INTERVAL:
                return
            self._session_polled_at = now

        try:
            r = requests.get(f"{BACKEND_URL}/api/ai/status", headers=HEADERS, timeout=3)
            if r.status_code == 200:
                data = r.json()
                sess = data.get("active_session")
                with self._lock:
                    new_sid = sess["id"]        if sess else None
                    new_cid = sess["course_id"] if sess else None
                    if new_sid != self._session_id:
                        log.info("[Dispatcher] Session updated: %s → %s", self._session_id, new_sid)
                        self._session_id = new_sid
                        self._course_id  = new_cid
        except Exception as e:
            log.debug("[Dispatcher] Session poll failed: %s", e)

    def _flush(self):
        with self._lock:
            if not self._queue:
                return
            batch = [self._queue.popleft()
                     for _ in range(min(MAX_BATCH_SIZE, len(self._queue)))]
        if not batch:
            return
        self._send_with_retry(batch)

    def _send_with_retry(self, batch: list):
        if not _requests_ok:
            return
        delay = RETRY_BASE_DELAY
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                r = requests.post(
                    f"{BACKEND_URL}/api/ai/batch",
                    json={"events": batch},
                    headers=HEADERS,
                    timeout=6,
                )
                if r.status_code == 200:
                    d = r.json()
                    log.debug(
                        "[Dispatcher] Flushed %d events → att:%d beh:%d err:%d",
                        len(batch),
                        d.get("results", {}).get("attendance", 0),
                        d.get("results", {}).get("behavior",  0),
                        d.get("results", {}).get("errors",    0),
                    )
                    return
                log.warning("[Dispatcher] HTTP %d on attempt %d", r.status_code, attempt)
            except Exception as e:
                log.warning("[Dispatcher] Attempt %d: %s", attempt, e)
            if attempt < MAX_RETRIES:
                time.sleep(delay)
                delay = min(delay * 2, 8.0)

        log.error("[Dispatcher] Dropped %d events after %d retries", len(batch), MAX_RETRIES)


# ── Helpers ───────────────────────────────────────────────────────────

def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Singleton ─────────────────────────────────────────────────────────
_dispatcher = EventDispatcher()

def get_dispatcher() -> EventDispatcher:
    return _dispatcher
