"""
YOLO Model Trainer — Model Validation Script
Produces M-xxx status codes as JSONL on stdout.

Usage: python model_check.py --model-path <path>
"""

import sys
import os
import argparse
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine.protocol import emit, exit_ok, exit_expected_error


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    return parser.parse_args()


def check_model(model_path: str) -> dict:
    path = Path(model_path)

    emit("M-001", message="模型校验开始", path=str(path))

    # 1. Path & extension
    if not path.exists():
        emit("M-004E", message=f"模型文件不存在: {path}")
        return {"valid": False, "model_type": None, "params_count": None, "file_size_mb": None,
                "error_message": f"文件不存在: {path}"}

    if path.suffix.lower() != ".pt":
        emit("M-003E", message=f"文件扩展名不正确 (.pt 要求): {path.suffix}")
        return {"valid": False, "model_type": None, "params_count": None, "file_size_mb": None,
                "error_message": f"扩展名应为 .pt，实际为 {path.suffix}"}

    # 2. File size
    size_bytes = path.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    if size_bytes < 100 * 1024:
        emit("M-002E", message=f"文件过小 ({size_mb:.1f} MB)，可能已损坏")
        return {"valid": False, "model_type": None, "params_count": None, "file_size_mb": round(size_mb, 1),
                "error_message": f"文件过小 ({size_mb:.1f} MB)，可能不是有效的模型文件"}

    emit("M-002", message=f"文件大小检测通过 ({size_mb:.1f} MB)")

    # 3. Try loading with PyTorch
    try:
        import torch
        checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    except Exception as e:
        emit("M-001E", message=f"无法加载模型文件: {e}")
        return {"valid": False, "model_type": None, "params_count": None, "file_size_mb": round(size_mb, 1),
                "error_message": f"PyTorch 无法加载此文件: {e}"}

    emit("M-003", message="PyTorch 加载成功")

    # 4. Extract model info
    model_type = "unknown"
    params_count = None

    # Try Ultralytics-style checkpoint
    if "model" in checkpoint:
        model = checkpoint["model"]
        if hasattr(model, "yaml"):
            model_type = model.yaml.get("model", "unknown") if isinstance(model.yaml, dict) else "YOLO"
    elif "train_args" in checkpoint:
        model_type = "YOLO (Ultralytics)"

    # Count parameters from state_dict
    if "model" in checkpoint and hasattr(checkpoint["model"], "state_dict"):
        try:
            state = checkpoint["model"].state_dict()
            params_count = sum(v.numel() for v in state.values())
        except Exception:
            pass

    # Fallback: try Ultralytics API
    if model_type == "unknown":
        try:
            from ultralytics import YOLO
            m = YOLO(str(path))
            model_type = f"YOLO ({m.model.yaml.get('yaml_file', 'unknown') if hasattr(m.model, 'yaml') else 'loaded'})"
        except Exception:
            pass

    if params_count is None:
        params_count = sum(
            v.numel() for k, v in checkpoint.items()
            if hasattr(v, "numel") and "model" not in k
        )
        if params_count == 0:
            params_count = None

    emit("M-004", model_type=model_type,
         params_count=f"{params_count / 1e6:.1f}M" if params_count else "unknown",
         file_size_mb=round(size_mb, 1),
         message=f"{model_type} · {params_count / 1e6:.1f}M 参数" if params_count else model_type)

    emit("M-005", valid=True, model_type=model_type,
         params_count=f"{params_count / 1e6:.1f}M" if params_count else "unknown",
         file_size_mb=round(size_mb, 1),
         message=f"模型校验通过 · {model_type}")

    return {
        "valid": True,
        "model_type": model_type,
        "params_count": f"{params_count / 1e6:.1f}M" if params_count else "unknown",
        "file_size_mb": round(size_mb, 1),
    }


def main():
    args = parse_args()
    try:
        result = check_model(args.model_path)
        exit_ok()
    except Exception as e:
        emit("M-004E", message=f"模型校验异常: {e}")
        sys.exit(-1)


if __name__ == "__main__":
    main()
