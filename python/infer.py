"""
YOLO Model Trainer — Inference Script
Produces I-xxx status codes as JSONL on stdout.

Usage: python infer.py --model-path <path> --image-path <path> [--conf 0.25] [--iou 0.45] [--imgsz 640]
"""

import sys
import os
import argparse
import json
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine.protocol import emit, exit_ok, exit_expected_error


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--image-path", required=True)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--iou", type=float, default=0.45)
    parser.add_argument("--imgsz", type=int, default=640)
    return parser.parse_args()


def run_inference(model_path: str, image_path: str, conf: float, iou: float, imgsz: int) -> dict:
    emit("I-001", message="推理请求已接收", model_path=model_path, image_path=image_path)

    # 1. Validate model
    model_file = Path(model_path)
    if not model_file.exists():
        emit("I-002E", message=f"模型文件不存在: {model_path}")
        return None

    # 2. Validate image
    img_file = Path(image_path)
    if not img_file.exists():
        emit("I-004E", message=f"图片文件不存在: {image_path}")
        return None

    supported = {".jpg", ".jpeg", ".png", ".bmp"}
    if img_file.suffix.lower() not in supported:
        emit("I-004E", message=f"不支持的图片格式: {img_file.suffix}")
        return None

    # 3. Load model
    emit("I-002", message="加载模型中…")
    try:
        from ultralytics import YOLO
        model = YOLO(str(model_file))
    except Exception as e:
        emit("I-002E", message=f"模型加载失败: {e}")
        return None
    emit("I-003", message="模型加载完成")

    # 4. Load image
    emit("I-004", message="图片加载完成", image_path=str(img_file))

    # 5. Run inference
    emit("I-005", message="推理执行中…")
    t_start = time.time()
    try:
        results = model.predict(
            source=str(img_file),
            conf=conf,
            iou=iou,
            imgsz=imgsz,
            verbose=False,
        )
    except Exception as e:
        emit("I-005E", message=f"推理执行失败: {e}")
        return None

    elapsed_ms = (time.time() - t_start) * 1000

    if not results or len(results) == 0:
        emit("I-006E", message="推理结果为空（可能未检测到目标或阈值过高）")
        return {
            "detections": [],
            "stats": {
                "total": 0,
                "inference_time_ms": round(elapsed_ms, 1),
                "input_size": f"{results[0].orig_shape[1]}x{results[0].orig_shape[0]}" if results else "unknown",
                "inference_size": str(imgsz),
                "conf_threshold": conf,
                "iou_threshold": iou,
            },
        }

    r = results[0]
    detections = []
    if r.boxes is not None:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cls_name = model.names.get(cls_id, f"class_{cls_id}") if hasattr(model, "names") else f"class_{cls_id}"
            detections.append({
                "class": cls_name,
                "confidence": round(float(box.conf[0]), 4),
                "bbox": [round(float(x), 1) for x in box.xyxy[0].tolist()],
            })

    emit("I-006", total_detections=len(detections), detections=detections,
         inference_time_ms=round(elapsed_ms, 1),
         message=f"推理完成 · {len(detections)} 个目标 · {elapsed_ms:.0f}ms")

    stats = {
        "total": len(detections),
        "inference_time_ms": round(elapsed_ms, 1),
        "input_size": f"{r.orig_shape[1]}x{r.orig_shape[0]}",
        "inference_size": str(imgsz),
        "conf_threshold": conf,
        "iou_threshold": iou,
    }

    emit("I-008", message="推理结果已就绪")

    return {
        "detections": detections,
        "stats": stats,
    }


def main():
    args = parse_args()
    try:
        result = run_inference(args.model_path, args.image_path, args.conf, args.iou, args.imgsz)
        exit_ok()
    except Exception as e:
        emit("I-007E", message=f"推理异常: {e}")
        sys.exit(-1)


if __name__ == "__main__":
    main()
