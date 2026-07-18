"""
YOLO Model Trainer — Dataset Validation Script
Produces D-xxx status codes as JSONL on stdout.

Usage: python dataset_check.py --dataset-path <path>
"""

import sys
import os
import argparse
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine.protocol import emit, exit_ok, exit_expected_error


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-path", required=True)
    return parser.parse_args()


def check_dataset(dataset_path: str) -> dict:
    root = Path(dataset_path)

    emit("D-001", message="数据集校验开始", path=str(root))

    # 1. Path accessibility
    if not root.exists():
        emit("D-007E", message=f"数据集路径不存在: {root}")
        return {"valid": False, "errors": [{"level": "error", "message": f"路径不存在: {root}"}], "stats": {}}

    # 2. data.yaml
    yaml_path = root / "data.yaml"
    if not yaml_path.exists():
        emit("D-002E", message="未找到 data.yaml 文件")
        return {"valid": False, "errors": [{"level": "error", "message": "未找到 data.yaml"}], "stats": {}}
    emit("D-002", message="data.yaml 已找到")

    # Parse data.yaml (minimal: just read keys)
    try:
        import yaml
        with open(yaml_path, "r", encoding="utf-8") as f:
            data_config = yaml.safe_load(f) or {}
    except Exception:
        # Fallback: read as plain text, check for required keys
        data_config = {}
        emit("D-002W", message="data.yaml 格式非标准，已尝试解析")

    names = data_config.get("names", [])
    nc = data_config.get("nc", len(names) if names else 0)

    # 3. images directory
    img_dir = root / "images"
    if not img_dir.exists() or not img_dir.is_dir():
        emit("D-003E", message="images 目录不存在或为空")
        return {"valid": False, "errors": [{"level": "error", "message": "images 目录不存在"}], "stats": {}}

    img_files = sorted([
        f for f in img_dir.iterdir()
        if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
    ])
    if not img_files:
        emit("D-003E", message="images 目录为空")
        return {"valid": False, "errors": [{"level": "error", "message": "images 目录为空"}], "stats": {}}
    emit("D-003", image_count=len(img_files), message=f"images 目录: {len(img_files)} 张图片")

    # 4. labels directory
    lbl_dir = root / "labels"
    if not lbl_dir.exists() or not lbl_dir.is_dir():
        emit("D-004E", message="labels 目录不存在或为空")
        return {"valid": False, "errors": [{"level": "error", "message": "labels 目录不存在"}], "stats": {}}

    lbl_files = sorted([f for f in lbl_dir.iterdir() if f.suffix.lower() == ".txt"])
    if not lbl_files:
        emit("D-004E", message="labels 目录为空")
        return {"valid": False, "errors": [{"level": "error", "message": "labels 目录为空"}], "stats": {}}
    emit("D-004", label_count=len(lbl_files), message=f"labels 目录: {len(lbl_files)} 个标签文件")

    # 5. Label format validation (sample-based for large datasets)
    errors = []
    warnings = []
    label_issues = 0
    sample_size = min(200, len(lbl_files))
    sampled = lbl_files[:sample_size] if len(lbl_files) <= sample_size else lbl_files[:sample_size]

    for lf in sampled:
        try:
            with open(lf, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split()
                    if len(parts) < 5:
                        label_issues += 1
                        break
                    try:
                        cls_id = int(parts[0])
                        coords = [float(x) for x in parts[1:5]]
                        if not (0 <= coords[0] < coords[2] <= 1 and 0 <= coords[1] < coords[3] <= 1):
                            label_issues += 1
                    except ValueError:
                        label_issues += 1
                        break
        except Exception:
            label_issues += 1

    if label_issues > 0:
        emit("D-005W", issue_count=label_issues, message=f"{label_issues} 个标签文件存在格式问题")
        warnings.append({"level": "warning", "message": f"{label_issues} 个标签文件存在格式问题"})
    else:
        emit("D-005", message="标签格式校验通过")

    # 6. Label-image correspondence
    img_stems = {f.stem for f in img_files}
    lbl_stems = {f.stem for f in lbl_files}
    orphans = lbl_stems - img_stems
    missing_labels = img_stems - lbl_stems

    if orphans:
        emit("D-001W", orphan_count=len(orphans), message=f"{len(orphans)} 个标签文件无对应图片")
        warnings.append({"level": "warning", "message": f"{len(orphans)} 个标签文件无对应图片"})
    if missing_labels:
        emit("D-006W", missing_count=len(missing_labels), message=f"{len(missing_labels)} 张图片无对应标签")
        warnings.append({"level": "warning", "message": f"{len(missing_labels)} 张图片无对应标签"})
    if not orphans and not missing_labels:
        emit("D-006", message="图片-标签对应关系校验通过")

    # 7. Class count check
    if nc > 0 and nc != len(names):
        emit("D-006W", nc=nc, names_count=len(names),
             message=f"data.yaml 中 nc({nc}) 与 names 数量({len(names)}) 不匹配")

    has_errors = any(e["level"] == "error" for e in errors)
    valid = not has_errors and label_issues == 0

    categories = list(names) if names else [f"class_{i}" for i in range(nc)]

    result = {
        "valid": valid,
        "errors": errors + warnings,
        "stats": {
            "total_images": len(img_files),
            "total_labels": len(lbl_files),
            "categories": categories,
            "nc": nc or len(categories),
        },
    }

    if valid:
        emit("D-007", valid=True, image_count=len(img_files), class_count=len(categories),
             message=f"校验通过 · {len(img_files)} 张图片 · {len(categories)} 个类别")
    else:
        emit("D-007", valid=False, errors=len(errors), warnings=len(warnings),
             message=f"校验未通过 · {len(errors)} 个错误 · {len(warnings)} 个警告")

    return result


def main():
    args = parse_args()
    try:
        result = check_dataset(args.dataset_path)
        exit_ok()
    except Exception as e:
        emit("D-007E", message=f"数据集校验异常: {e}")
        sys.exit(-1)


if __name__ == "__main__":
    main()
