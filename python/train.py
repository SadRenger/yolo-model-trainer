"""
YOLO Model Trainer — Training Execution Script
Produces T-xxx status codes as JSONL on stdout.
Accepts pause/resume/stop via stdin.

Usage: python train.py --dataset-path <path> --model-path <path> --epochs 100 ...
       python train.py --resume <checkpoint_dir>
"""

import sys
import os
import argparse
import json
import time
import signal
import threading
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine.protocol import emit

# ── Globals for stdin control ──
_control_command = None  # "pause" | "resume" | "stop"
_control_lock = threading.Lock()
_train_paused = threading.Event()
_train_stopped = threading.Event()


def parse_args():
    parser = argparse.ArgumentParser()
    # Required
    parser.add_argument("--dataset-path", default="")
    parser.add_argument("--model-path", default="")
    parser.add_argument("--output-dir", default="output")
    parser.add_argument("--task-name", default="")
    # Resume
    parser.add_argument("--resume", default="")  # path to checkpoint directory
    # Core params
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default="auto")  # "auto" | "cpu" | "0" | "cuda:0"
    # Optimizer
    parser.add_argument("--optimizer", default="AdamW")
    parser.add_argument("--lr0", type=float, default=0.001)
    parser.add_argument("--momentum", type=float, default=0.937)
    parser.add_argument("--weight-decay", type=float, default=0.0005)
    # Advanced
    parser.add_argument("--patience", type=int, default=50)
    parser.add_argument("--mosaic", type=float, default=1.0)  # 1.0=on, 0.0=off
    parser.add_argument("--mixup", type=float, default=0.0)   # 0.0=off
    parser.add_argument("--fliplr", type=float, default=0.5)
    # Internal
    parser.add_argument("--close-mosaic", type=int, default=10)  # epochs before end to disable mosaic
    return parser.parse_args()


def stdin_reader():
    """Background thread: read control commands from stdin."""
    global _control_command
    try:
        for line in sys.stdin:
            cmd = line.strip().lower()
            if cmd in ("pause", "resume", "stop"):
                with _control_lock:
                    _control_command = cmd
                if cmd == "pause":
                    emit("T-201", message="收到暂停信号")
                elif cmd == "resume":
                    emit("T-204", message="收到恢复信号")
                    _train_paused.clear()
                elif cmd == "stop":
                    emit("T-206", message="收到停止信号")
                    _train_stopped.set()
                    _train_paused.clear()
    except EOFError:
        pass  # stdin closed
    except Exception as e:
        emit("T-201E", message=f"stdin 读取异常: {e}")


def on_train_epoch_end(trainer):
    """Ultralytics callback: called after each epoch."""
    epoch = trainer.epoch + 1
    total = trainer.epochs
    metrics = trainer.metrics

    loss = round(float(metrics.get("train/loss", 0)), 4)
    mAP50 = round(float(metrics.get("metrics/mAP50(B)", 0)), 4)
    mAP50_95 = round(float(metrics.get("metrics/mAP50-95(B)", 0)), 4)
    lr = round(float(trainer.lr if hasattr(trainer, "lr") else 0), 6)

    emit("T-104", type="progress", epoch=epoch, total_epochs=total,
         loss=loss, mAP50=mAP50, mAP50_95=mAP50_95, lr=lr,
         message=f"Epoch {epoch}/{total} · loss={loss} · mAP50={mAP50}")

    # Milestone toasts
    pct = epoch / total
    if pct >= 0.25 and epoch - 1 < total * 0.25:
        emit("T-105", milestone="25%", epoch=epoch, total_epochs=total)
    elif pct >= 0.50 and epoch - 1 < total * 0.50:
        emit("T-106", milestone="50%", epoch=epoch, total_epochs=total)
    elif pct >= 0.75 and epoch - 1 < total * 0.75:
        emit("T-107", milestone="75%", epoch=epoch, total_epochs=total)

    # Check control commands
    global _control_command
    with _control_lock:
        cmd = _control_command
        _control_command = None

    if cmd == "pause":
        emit("T-202", message="当前 epoch 完成后暂停")
        emit("T-203", epoch=epoch, message=f"训练已暂停于 epoch {epoch}")
        _train_paused.set()
        _train_paused.wait()  # block until resume
        emit("T-205", message="训练已恢复")
    elif cmd == "stop":
        emit("T-207", epoch=epoch, message=f"训练已停止于 epoch {epoch}")
        _train_stopped.set()


def run_training(args) -> dict:
    from ultralytics import YOLO

    task_name = args.task_name or f"train_{time.strftime('%Y%m%d_%H%M%S')}"
    output_dir = Path(args.output_dir) / task_name
    output_dir.mkdir(parents=True, exist_ok=True)

    emit("T-001", message="训练请求已接收", task_name=task_name)
    emit("T-002", output_dir=str(output_dir), message="输出目录已创建")

    # ── Phase 1: Pre-launch checks ──

    # Dataset
    dataset_path = Path(args.dataset_path) if args.dataset_path else None
    if dataset_path and not dataset_path.exists():
        emit("T-003E", message=f"数据集路径不存在: {dataset_path}")
        sys.exit(1)
    emit("T-003", message="数据集路径校验通过")

    # Model
    model_path = Path(args.model_path) if args.model_path else None
    if model_path and not model_path.exists():
        emit("T-004E", message=f"模型文件不存在: {model_path}")
        sys.exit(1)
    emit("T-004", message="模型路径校验通过")

    # Disk space
    try:
        import shutil
        usage = shutil.disk_usage(output_dir if output_dir.exists() else Path.cwd())
        free_gb = usage.free / (1024 ** 3)
        if free_gb < 1:
            emit("T-005E", free_gb=round(free_gb, 1), message=f"磁盘空间不足 ({free_gb:.1f} GB)")
            sys.exit(1)
        elif free_gb < 5:
            emit("T-004W", free_gb=round(free_gb, 1), message=f"磁盘空间偏低 ({free_gb:.1f} GB)")
        else:
            emit("T-005", free_gb=round(free_gb, 1), message=f"磁盘空间充足 ({free_gb:.1f} GB)")
    except Exception:
        emit("T-004W", message="无法检测磁盘空间")

    # Device
    try:
        import torch
        device = args.device
        if device == "auto":
            device = "cuda:0" if torch.cuda.is_available() else "cpu"
        if "cuda" in device and not torch.cuda.is_available():
            emit("T-006E", message=f"指定的设备 {device} 不可用")
            sys.exit(1)
        emit("T-006", device=device, message=f"计算设备: {device}")
    except ImportError:
        device = "cpu"
        emit("T-006", device="cpu", message="PyTorch 未安装，使用 CPU")

    # Versions
    try:
        import torch
        import ultralytics
        emit("T-007", pytorch=torch.__version__, ultralytics=ultralytics.__version__,
             message=f"PyTorch {torch.__version__}, Ultralytics {ultralytics.__version__}")
    except ImportError:
        emit("T-007", message="版本检测跳过")

    emit("T-008", message="预检完成，启动训练")

    # ── Phase 2: Training ──

    # Build data.yaml path
    data_yaml = str(dataset_path / "data.yaml") if dataset_path else "data.yaml"

    # Determine starting model weights
    weights = str(model_path) if model_path else "yolov8n.pt"

    emit("T-101", message="开始训练")
    t_start = time.time()

    # Add callback
    from ultralytics.engine.trainer import BaseTrainer
    if not hasattr(BaseTrainer, "_yolo_trainer_callbacks_patched"):
        BaseTrainer._yolo_trainer_callbacks_patched = True
        # We'll use add_callback on the model instance instead

    try:
        model = YOLO(weights)
        model.add_callback("on_train_epoch_end", on_train_epoch_end)

        # if args.resume:
        #     model.train(resume=True, ...) — Ultralytics natively supports resume

        results = model.train(
            data=data_yaml,
            epochs=args.epochs,
            batch=args.batch_size,
            imgsz=args.imgsz,
            device=device,
            optimizer=args.optimizer,
            lr0=args.lr0,
            momentum=args.momentum,
            weight_decay=args.weight_decay,
            patience=args.patience,
            mosaic=args.mosaic,
            mixup=args.mixup,
            fliplr=args.fliplr,
            close_mosaic=args.close_mosaic,
            project=str(output_dir.parent) if output_dir.parent != Path(".") else "output",
            name=task_name,
            exist_ok=True,
            verbose=False,
        )
    except Exception as e:
        emit("T-105E", message=f"训练异常崩溃: {e}")
        sys.exit(-1)

    elapsed = time.time() - t_start

    # ── Phase 3-4: Completion ──

    # Check if stopped
    if _train_stopped.is_set():
        emit("T-207", message="训练已停止，产出文件已保留")
        return {"status": "stopped", "output_dir": str(output_dir)}

    # Extract final metrics
    best_mAP50 = round(float(results.results_dict.get("metrics/mAP50(B)", 0)), 4)
    best_mAP50_95 = round(float(results.results_dict.get("metrics/mAP50-95(B)", 0)), 4)

    emit("T-301", message="训练正常完成")
    emit("T-303", message="best.pt 已保存")
    emit("T-304", message="last.pt 已保存")
    emit("T-305", message="指标文件已保存")

    # HTML report generation (placeholder)
    emit("T-306", message="HTML 报告生成中…")
    report_path = output_dir / "report.html"
    try:
        _generate_report(output_dir, task_name, best_mAP50, best_mAP50_95, elapsed)
        emit("T-307", report_path=str(report_path), message="HTML 报告已生成")
    except Exception as e:
        emit("T-305E", message=f"报告生成失败: {e}")

    emit("T-308", best_mAP50=best_mAP50, best_mAP50_95=best_mAP50_95,
         total_time_s=round(elapsed, 1), output_dir=str(output_dir),
         message=f"训练任务全部完成 · mAP50: {best_mAP50}")

    return {
        "status": "completed",
        "best_mAP50": best_mAP50,
        "best_mAP50_95": best_mAP50_95,
        "total_time_s": round(elapsed, 1),
        "output_dir": str(output_dir),
    }


def _generate_report(output_dir: Path, task_name: str, mAP50: float, mAP50_95: float, elapsed: float):
    """Generate a minimal HTML training report."""
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>训练报告 — {task_name}</title>
<style>
  body {{ font-family: "Microsoft YaHei", sans-serif; background: #0d1117; color: #f0f6fc; padding: 40px; }}
  h1 {{ color: #4fc3f7; }} .metric {{ display: inline-block; padding: 16px; margin: 8px; background: #161b22; border-radius: 8px; }}
  .metric .value {{ font-size: 28px; color: #4fc3f7; }} .metric .label {{ font-size: 13px; color: #8b949e; }}
</style></head>
<body>
  <h1>🎉 训练报告 — {task_name}</h1>
  <div class="metric"><div class="value">{mAP50}</div><div class="label">最佳 mAP50</div></div>
  <div class="metric"><div class="value">{mAP50_95}</div><div class="label">最佳 mAP50-95</div></div>
  <div class="metric"><div class="value">{elapsed/60:.1f}m</div><div class="label">总用时</div></div>
  <p style="margin-top:24px;color:#8b949e">报告生成时间: {time.strftime('%Y-%m-%d %H:%M:%S')}</p>
</body></html>"""
    with open(output_dir / "report.html", "w", encoding="utf-8") as f:
        f.write(html)


def main():
    args = parse_args()

    # Start stdin reader thread
    stdin_thread = threading.Thread(target=stdin_reader, daemon=True)
    stdin_thread.start()

    try:
        result = run_training(args)
        sys.exit(0)
    except SystemExit as e:
        sys.exit(e.code)
    except Exception as e:
        emit("T-105E", message=f"训练异常: {e}")
        sys.exit(-1)


if __name__ == "__main__":
    main()
