"""
TRACKIFY — Student Filter
Fetches the list of students enrolled in the active session's course
and provides fast O(1) lookup during AI pipeline processing.

Key guarantees:
  • Only enrolled students are processed for attendance/behavior.
  • Unrecognised faces or students from a different course → ignored
    (or flagged as "unauthorized" if configured).
  • The enrolled list is refreshed:
      - When the active session changes
      - Every REFRESH_INTERVAL seconds (to pick up new enrolments)
  • Thread-safe: read path never blocks the camera loop.
"""

import threading
import time
import logging

try:
    import requests
    _requests_ok = True
except ImportError:
    _requests_ok = False

log = logging.getLogger("trackify.student_filter")

BACKEND_URL      = "http://localhost:3001"
API_KEY          = "local-anon-key"
REFRESH_INTERVAL = 30   # seconds between enrollment list refreshes

HEADERS = {
    "Content-Type":  "application/json",
    "apikey":        API_KEY,
    "Authorization": f"Bearer {API_KEY}",
}


class StudentFilter:
    """
    Thread-safe filter that decides whether a recognised student_id
    should be processed in the current session.

    Usage:
        sf = StudentFilter()
        sf.refresh(session_id="...", course_id="...")

        if sf.is_enrolled(student_id):
            dispatcher.push_attendance(student_id, confidence)
        else:
            # student not in this course — mark as unauthorized
            pass
    """

    def __init__(self):
        self._lock            = threading.RLock()
        self._enrolled_ids:   set  = set()     # student_id strings
        self._student_map:    dict = {}         # student_id → {full_name, student_code}
        self._session_id:     str | None = None
        self._course_id:      str | None = None
        self._last_refresh:   float = 0.0
        self._allow_all       = False           # True if no course is set (open mode)

    # ── Public API ────────────────────────────────────────────────────

    def is_enrolled(self, student_id: str) -> bool:
        """Returns True if this student belongs to the active session's course."""
        if not student_id or student_id == "Unknown":
            return False
        with self._lock:
            if self._allow_all:
                return True
            return student_id in self._enrolled_ids

    def student_info(self, student_id: str) -> dict | None:
        """Returns {full_name, student_code} or None if not enrolled."""
        with self._lock:
            return self._student_map.get(student_id)

    def enrolled_count(self) -> int:
        with self._lock:
            return len(self._enrolled_ids)

    def course_id(self) -> str | None:
        with self._lock:
            return self._course_id

    def session_id(self) -> str | None:
        with self._lock:
            return self._session_id

    def needs_refresh(self) -> bool:
        """True if the enrolled list is stale and should be refreshed."""
        return time.monotonic() - self._last_refresh > REFRESH_INTERVAL

    def refresh(self, session_id: str | None = None, course_id: str | None = None):
        """
        Fetch the enrolled student list from the backend.
        If course_id is None, fetches the active session's course first.
        """
        if not _requests_ok:
            log.warning("[StudentFilter] requests not installed, filter disabled")
            with self._lock:
                self._allow_all = True
            return

        try:
            # Step 1: resolve session + course if not provided
            if not course_id:
                r = requests.get(f"{BACKEND_URL}/api/ai/status", headers=HEADERS, timeout=3)
                if r.status_code == 200:
                    data = r.json()
                    sess = data.get("active_session")
                    if sess:
                        session_id = sess["id"]
                        course_id  = sess.get("course_id")

            # Step 2: fetch enrolled students for this course
            if course_id:
                r2 = requests.get(
                    f"{BACKEND_URL}/rest/v1/enrollments",
                    params={"course_id": f"eq.{course_id}", "select": "student_id,students(id,full_name,student_code)"},
                    headers=HEADERS,
                    timeout=5,
                )
                if r2.status_code == 200:
                    rows = r2.json() or []
                    enrolled_ids = set()
                    student_map  = {}
                    for row in rows:
                        sid = row.get("student_id") or (row.get("students") or {}).get("id")
                        if sid:
                            enrolled_ids.add(sid)
                            s = row.get("students") or {}
                            student_map[sid] = {
                                "full_name":    s.get("full_name", ""),
                                "student_code": s.get("student_code", ""),
                            }

                    with self._lock:
                        self._enrolled_ids  = enrolled_ids
                        self._student_map   = student_map
                        self._session_id    = session_id
                        self._course_id     = course_id
                        self._allow_all     = False
                        self._last_refresh  = time.monotonic()

                    log.info(
                        "[StudentFilter] Refreshed: %d students enrolled in course %s",
                        len(enrolled_ids), course_id
                    )
                    return

            # No course_id → allow all (no active session or open mode)
            with self._lock:
                self._allow_all    = True
                self._session_id   = session_id
                self._course_id    = course_id
                self._last_refresh = time.monotonic()
            log.info("[StudentFilter] No active course — running in open mode (all students allowed)")

        except Exception as e:
            log.warning("[StudentFilter] Refresh failed: %s", e)
            with self._lock:
                # On failure, fall back to allow-all so pipeline keeps running
                self._allow_all    = True
                self._last_refresh = time.monotonic()

    def reset(self):
        """Clear filter state when a session resets."""
        with self._lock:
            self._enrolled_ids.clear()
            self._student_map.clear()
            self._session_id   = None
            self._course_id    = None
            self._allow_all    = False
            self._last_refresh = 0.0
        log.info("[StudentFilter] Reset")

    def status_str(self) -> str:
        with self._lock:
            if self._allow_all:
                return "open (no course)"
            return f"{len(self._enrolled_ids)} enrolled in course {self._course_id}"
