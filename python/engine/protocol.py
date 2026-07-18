"""
YOLO Model Trainer — JSONL Protocol Helpers
stdout: one JSON object per line, every line has a `code` field
stderr: only for fatal errors (process crash)
exit code: 0=success, 1=expected error, -1=unexpected exception
"""

import sys
import json
from typing import Any, Dict


def emit(code: str, **kwargs: Any) -> None:
    """Write a JSON line to stdout and flush immediately."""
    payload: Dict[str, Any] = {"code": code}
    payload.update(kwargs)
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


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
