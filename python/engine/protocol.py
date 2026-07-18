"""
YOLO Model Trainer — JSONL Protocol Helpers
stdout: one JSON object per line, every line has a `code` field
stderr: only for fatal errors (process crash)
exit code: 0=success, 1=expected error, -1=unexpected exception
"""

import sys
import json
from typing import Any, Dict

# Force UTF-8 for stdout pipe IPC on Windows.
# Rust sets PYTHONIOENCODING=utf-8, but reconfigure here as safeguard.
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except OSError:
        pass


def emit(code: str, **kwargs: Any) -> None:
    """Write a JSON line to stdout.

    Uses ASCII-safe JSON to avoid Windows pipe encoding issues.
    OSError on flush is non-fatal: data is still written to the pipe.
    """
    payload: Dict[str, Any] = {"code": code}
    payload.update(kwargs)
    # Use ensure_ascii=True to avoid Windows pipe encoding issues with Chinese
    line = json.dumps(payload, ensure_ascii=True) + "\n"
    sys.stdout.write(line)
    try:
        sys.stdout.flush()
    except OSError:
        pass  # Windows pipe flush may fail; data is still buffered


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
