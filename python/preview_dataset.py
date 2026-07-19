"""
YOLO Model Trainer — Dataset Preview Script
Loads dataset images, draws bounding boxes via OpenCV, returns base64-encoded previews.

Usage: python preview_dataset.py --dataset-path <path> [--max-count 20]
"""

import sys
import os
import argparse
import json
import base64
import io
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine.protocol import emit, exit_ok, exit_expected_error

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

try:
    import yaml as _yaml_lib
except ImportError:
    _yaml_lib = None


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-path", required=True)
    parser.add_argument("--max-count", type=int, default=20)
    return parser.parse_args()


def load_class_names(dataset_path: Path) -> list:
    """Extract class names from data.yaml."""
    yaml_path = dataset_path / "data.yaml"
    if not yaml_path.exists():
        return []
    try:
        if _yaml_lib:
            with open(yaml_path, "r", encoding="utf-8") as f:
                data = _yaml_lib.safe_load(f) or {}
        else:
            data = {}
        names = data.get("names", [])
        if isinstance(names, dict):
            return [names.get(i, f"class_{i}") for i in range(max(names.keys()) + 1)]
        if isinstance(names, list):
            return [str(n) for n in names]
        return []
    except Exception:
        return []


def draw_boxes(image: np.ndarray, label_path: Path, class_names: list) -> np.ndarray:
    """Draw YOLO-format bounding boxes on an image."""
    if not label_path.exists():
        return image

    h, w = image.shape[:2]
    try:
        with open(label_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) < 5:
                    continue
                try:
                    cls_id = int(parts[0])
                    x, y, bw, bh = [float(v) for v in parts[1:5]]
                except ValueError:
                    continue

                # Convert normalized YOLO coords to pixel coords
                x1 = int((x - bw / 2) * w)
                y1 = int((y - bh / 2) * h)
                x2 = int((x + bw / 2) * w)
                y2 = int((y + bh / 2) * h)

                cls_name = class_names[cls_id] if cls_id < len(class_names) else f"class_{cls_id}"

                # Draw rectangle and label
                cv2.rectangle(image, (x1, y1), (x2, y2), (79, 195, 247), 2)  # #4fc3f7
                cv2.putText(image, cls_name, (x1, max(y1 - 4, 12)),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (79, 195, 247), 1)
    except Exception:
        pass

    return image


def encode_base64(image: np.ndarray) -> str:
    """Encode an OpenCV image as a base64 JPEG data URL."""
    _, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def generate_previews(dataset_path: str, max_count: int) -> list:
    root = Path(dataset_path)
    if not root.exists():
        emit("D-007E", message=f"数据集路径不存在: {root}")
        return []

    if not HAS_CV2:
        emit("D-007E", message="OpenCV (cv2) 未安装，无法生成预览")
        return []

    class_names = load_class_names(root)
    img_dir = root / "images"
    lbl_dir = root / "labels"

    if not img_dir.exists():
        return []

    img_files = sorted([
        f for f in img_dir.iterdir()
        if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp"}
    ])[:max_count]

    results = []
    for img_file in img_files:
        lbl_file = lbl_dir / (img_file.stem + ".txt")
        image = cv2.imread(str(img_file))
        if image is None:
            continue
        image = draw_boxes(image, lbl_file, class_names)
        b64 = encode_base64(image)

        # Count detections in label file
        det_count = 0
        if lbl_file.exists():
            try:
                with open(lbl_file, "r") as f:
                    det_count = sum(1 for line in f if line.strip())
            except Exception:
                pass

        cls_in_image = set()
        if lbl_file.exists():
            try:
                with open(lbl_file, "r") as f:
                    for line in f:
                        parts = line.strip().split()
                        if parts:
                            cid = int(parts[0])
                            name = class_names[cid] if cid < len(class_names) else f"class_{cid}"
                            cls_in_image.add(name)
            except Exception:
                pass

        results.append({
            "filename": img_file.name,
            "base64": b64,
            "detection_count": det_count,
            "classes": sorted(cls_in_image),
        })

    return results


def main():
    args = parse_args()
    try:
        previews = generate_previews(args.dataset_path, args.max_count)
        emit("P-001", previews=previews, count=len(previews),
             message=f"预览生成完成 · {len(previews)} 张图片")
        exit_ok()
    except Exception as e:
        emit("P-001E", message=f"预览生成异常: {e}")
        sys.exit(-1)


if __name__ == "__main__":
    main()
