"""
YOLO Model Trainer — Environment Detection Script
Produces E-xxx status codes as JSONL on stdout.
"""

import sys
import os
import shutil
import platform

# Allow running from project root: python/python env_check.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine.protocol import emit, exit_ok


def check_python() -> dict:
    """Check Python version."""
    emit("E-001", message="环境检测开始")
    ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    emit("E-002", python_version=ver, message=f"Python {ver}")
    return {"ready": True, "version": ver}


def check_pytorch() -> dict:
    """Check PyTorch + CUDA availability."""
    try:
        import torch
        ver = torch.__version__
        cuda_available = torch.cuda.is_available()
        cuda_version = torch.version.cuda if cuda_available else None
        emit("E-003", pytorch_version=ver, cuda_available=cuda_available, cuda_version=cuda_version,
             message=f"PyTorch {ver}, CUDA: {'可用' if cuda_available else '不可用'}")
        return {"ready": True, "version": ver, "cuda_available": cuda_available, "cuda_version": cuda_version}
    except ImportError:
        emit("E-003W", pytorch_version=None, cuda_available=False,
             message="PyTorch 未安装 — 将无法进行训练和推理")
        return {"ready": False, "version": None, "cuda_available": False}


def check_gpu() -> list:
    """Enumerate NVIDIA GPUs."""
    gpus = []
    try:
        import torch
        if torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                name = torch.cuda.get_device_name(i)
                free_bytes, total_bytes = torch.cuda.mem_get_info(i)
                total_mb = total_bytes / (1024 ** 2)
                gpus.append({
                    "index": i,
                    "name": name,
                    "vram_total_mb": round(total_mb),
                    "vram_total": f"{total_mb / 1024:.1f} GB",
                })
            emit("E-004", gpu_count=len(gpus), gpus=gpus)
        else:
            emit("E-004W", gpu_count=0, message="未检测到 NVIDIA GPU — 将使用 CPU 训练（速度较慢）")
    except Exception as e:
        emit("E-004W", gpu_count=0, message=f"GPU 检测失败: {e}")

    return gpus


def check_disk() -> dict:
    """Check disk space on system drive and current drive."""
    drives = []
    # System drive
    system_drive = os.environ.get("SystemDrive", "C:")
    for drive in [system_drive, os.path.splitdrive(os.getcwd())[0] or system_drive]:
        try:
            usage = shutil.disk_usage(drive + "\\")
            free_gb = usage.free / (1024 ** 3)
            total_gb = usage.total / (1024 ** 3)
            drives.append({
                "drive": drive,
                "free_gb": round(free_gb, 1),
                "total_gb": round(total_gb, 1),
            })
        except Exception:
            pass

    emit("E-005", drives=drives, message=f"磁盘空间检测完成")
    return drives


def main():
    try:
        python = check_python()
        pytorch = check_pytorch()
        gpus = check_gpu()
        disks = check_disk()

        all_ready = python["ready"] and pytorch["ready"]
        emit("E-006", all_ready=all_ready, message="环境检测全部完成" if all_ready else "环境检测完成 — 存在异常项")

        exit_ok()
    except Exception as e:
        emit("E-006E", message=f"环境检测异常: {e}")
        sys.exit(-1)


if __name__ == "__main__":
    main()
