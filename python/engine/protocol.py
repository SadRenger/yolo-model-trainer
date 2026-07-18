"""
YOLO Model Trainer — JSONL Protocol Helpers
stdout: one JSON object per line, every line has a `code` field
stderr: only for fatal errors (process crash)
exit code: 0=success, 1=expected error, -1=unexpected exception
"""

import sys
import json
from typing import Any, Dict

# Force unbuffered stdout for pipe IPC on Windows.
# Also set by Rust via `python -u`, but this is a belt-and-suspenders safety.
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None


def emit(code: str, **kwargs: Any) -> None:
    """Write a JSON line to stdout and flush immediately."""
    payload: Dict[str, Any] = {"code": code}
    payload.update(kwargs)
    line = json.dumps(payload, ensure_ascii=False) + "\n"
    sys.stdout.write(line)
    try:
        sys.stdout.flush()
    except OSError:
        # On Windows, flushing a pipe can fail with EINVAL when the
        # Rust parent is reading asynchronously. The data is still
        # written to the pipe buffer — just not force-flushed.
        pass


def emit_error(code: str, message: str, **kwargs: Any) -> None:
    """Emit an error status code."""
    emit(code, message=message, **kwargs)


def fatal(message: str) -> None:
    """Write a fatal error to stderr and exit with code -1."""
    print(message, file=sys.stderr)
    sys.exit(-1)


def exit_ok() -> None:
    """Exit with code 0 (success)."""
    sys.exit(0)


def exit_expected_error(message: str) -> None:
    """Exit with code 1 (expected/validated error)."""
    print(message, file=sys.stderr)
    sys.exit(1)
