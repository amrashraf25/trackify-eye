"""
check_distribution.py — Shows class distribution in merged dataset.

Usage:
    python check_distribution.py [path_to_labels_dir]
    python check_distribution.py                          # defaults to ./merged_dataset/train/labels
    python check_distribution.py ./merged_dataset/val/labels
"""
import sys
from pathlib import Path
from collections import Counter

NAMES = {
    0: "person",
    1: "phone_use",
    2: "sleeping",
    3: "talking",
    4: "cheating",
    5: "fighting",
    6: "eating",
    7: "drinking",
}

MIN_RECOMMENDED = 300  # Minimum annotations per class for good training


def check(labels_dir: str):
    labels_path = Path(labels_dir)
    if not labels_path.exists():
        print(f"ERROR: {labels_path} does not exist")
        sys.exit(1)

    counts = Counter()
    images_with_class = {i: set() for i in NAMES}
    total_files = 0
    empty_files = 0

    for f in sorted(labels_path.glob("*.txt")):
        total_files += 1
        content = f.read_text(encoding="utf-8").strip()
        if not content:
            empty_files += 1
            continue

        for line in content.split("\n"):
            if not line.strip():
                continue
            parts = line.strip().split()
            cls = int(parts[0])
            counts[cls] += 1
            images_with_class[cls].add(f.stem)

    # Display
    print(f"\n{'='*60}")
    print(f"  Label Distribution: {labels_dir}")
    print(f"{'='*60}")
    print(f"  Total label files: {total_files}")
    print(f"  Empty label files: {empty_files}")
    print(f"{'─'*60}")

    max_count = max(counts.values()) if counts else 1
    for cls_id in sorted(NAMES):
        name = NAMES[cls_id]
        count = counts.get(cls_id, 0)
        img_count = len(images_with_class[cls_id])
        bar_len = int((count / max_count) * 30) if max_count > 0 else 0
        bar = "█" * bar_len
        warning = "  ⚠ LOW" if 0 < count < MIN_RECOMMENDED else ""
        missing = "  ✗ MISSING" if count == 0 else ""

        print(f"  {cls_id} {name:12s} : {count:5d} annot  ({img_count:4d} imgs)  {bar}{warning}{missing}")

    total = sum(counts.values())
    print(f"{'─'*60}")
    print(f"  Total annotations: {total}")
    print(f"{'='*60}\n")

    # Warnings
    low_classes = [NAMES[c] for c in NAMES if 0 < counts.get(c, 0) < MIN_RECOMMENDED]
    missing_classes = [NAMES[c] for c in NAMES if counts.get(c, 0) == 0]

    if low_classes:
        print(f"  ⚠  Low-data classes (< {MIN_RECOMMENDED}): {', '.join(low_classes)}")
        print(f"     → Consider: more data, augmentation, or oversampling\n")

    if missing_classes:
        print(f"  ✗  Missing classes: {', '.join(missing_classes)}")
        print(f"     → These classes have ZERO annotations in this split\n")

    # Imbalance ratio
    non_zero = {c: v for c, v in counts.items() if v > 0}
    if len(non_zero) >= 2:
        max_c = max(non_zero.values())
        min_c = min(non_zero.values())
        ratio = max_c / min_c
        if ratio > 10:
            print(f"  ⚠  Severe class imbalance: {ratio:.1f}x ratio (max/min)")
            print(f"     → Use class weights or oversample minority classes\n")
        elif ratio > 5:
            print(f"  ⚠  Moderate class imbalance: {ratio:.1f}x ratio")
            print(f"     → Monitor per-class AP during training\n")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "./merged_dataset/train/labels"
    check(path)
