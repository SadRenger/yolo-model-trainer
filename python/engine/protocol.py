"""
YOLO Model Trainer — JSONL Protocol Helpers
stdout: one JSON object per line, every line has a `code` field
stderr: only for fatal errors (process crash)
exit code: 0=success, 1=expected error, -1=unexpected exception
"""

import os
import sys
import json
from typing import Any, Dict

# On Windows, Python's TextIOWrapper wrapping a pipe can fail with EINVAL.
# Workaround: use the underlying binary buffer directly.
_use_binary = sys.platform == "win32"


def emit(code: str, **kwargs: Any) -> None:
    """Write a JSON line to stdout.

    On Windows when stdout is a pipe (subprocess IPC), the TextIOWrapper
    layer can fail with OSError 22. We bypass it by writing UTF-8 bytes
    directly to the binary buffer, then flushing with an os-level fsync.
    """
    payload: Dict[str, Any] = {"code": code}
    payload.update(kwargs)
    line = json.dumps(payload, ensure_ascii=False) + "\n"
    data = line.encode("utf-8")

    try:
        if _use_binary:
            sys.stdout.buffer.write(data)
            sys.stdout.buffer.flush()
        else:
            sys.stdout.write(line)
            sys.stdout.flush()
    except OSError:
        # Last resort: direct fd write + ignore errors
        try:
            os.write(1, data)
        except OSError:
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
