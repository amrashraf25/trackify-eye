"""
file_watcher.py
---------------
Monitors a single file for modifications and triggers a callback when a change
is detected.  Uses watchdog so no polling loop is needed in application code.

A short debounce window (default 2 s) prevents duplicate callbacks that can
occur when editors write a file in multiple steps (flush + metadata update).
"""

import logging
import threading
import time
from pathlib import Path
from typing import Callable, Optional

from watchdog.events import FileModifiedEvent, FileSystemEventHandler
from watchdog.observers import Observer

logger = logging.getLogger(__name__)


class _DebounceHandler(FileSystemEventHandler):
    """
    Fires *callback* when the watched file is modified, but only once per
    *debounce_seconds* window to suppress duplicate events.
    """

    def __init__(self, target: Path, callback: Callable[[], None], debounce_seconds: float = 2.0):
        super().__init__()
        self._target = target.resolve()
        self._callback = callback
        self._debounce = debounce_seconds
        self._last_fired: float = 0.0
        self._timer: Optional[threading.Timer] = None
        self._lock = threading.Lock()

    def on_modified(self, event: FileModifiedEvent) -> None:
        if event.is_directory:
            return
        changed = Path(event.src_path).resolve()
        if changed != self._target:
            return

        with self._lock:
            # Cancel any pending timer and reset the window
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(self._debounce, self._fire)
            self._timer.daemon = True
            self._timer.start()

    def _fire(self) -> None:
        logger.info("Change detected in '%s' — triggering update.", self._target.name)
        try:
            self._callback()
        except Exception:
            logger.exception("Error in file-change callback.")


class FileWatcher:
    """
    High-level wrapper around a watchdog Observer.

    Usage
    -----
    >>> watcher = FileWatcher("data.xlsx", on_change_callback)
    >>> watcher.start()
    ...
    >>> watcher.stop()
    """

    def __init__(
        self,
        file_path: str,
        callback: Callable[[], None],
        debounce_seconds: float = 2.0,
    ) -> None:
        self._file = Path(file_path).resolve()
        self._callback = callback
        self._debounce = debounce_seconds
        self._observer: Optional[Observer] = None

    # ── Public interface ─────────────────────────────────────────────────────

    @property
    def is_running(self) -> bool:
        return self._observer is not None and self._observer.is_alive()

    def start(self) -> None:
        if self.is_running:
            logger.warning("FileWatcher is already running.")
            return

        if not self._file.exists():
            raise FileNotFoundError(f"Cannot watch non-existent file: {self._file}")

        handler = _DebounceHandler(self._file, self._callback, self._debounce)
        self._observer = Observer()
        # Watch the *directory* — watchdog on Windows does not support file-level watching
        self._observer.schedule(handler, str(self._file.parent), recursive=False)
        self._observer.start()
        logger.info("Watching '%s' for changes …", self._file.name)

    def stop(self) -> None:
        if self._observer is None:
            return
        self._observer.stop()
        self._observer.join(timeout=5)
        self._observer = None
        logger.info("File watcher stopped.")
