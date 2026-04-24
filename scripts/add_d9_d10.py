"""
add_d9_d10.py — Adds D9 and D10 phone datasets to the existing merged_dataset.
Does NOT wipe the existing merged data (D1-D8 stay untouched).

Usage:
    python scripts/add_d9_d10.py
"""
import sys
import shutil
import random
from pathlib import Path
from collections import Counter

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

random.seed(42)

DATASETS_DIR = Path("C:/Users/FARES/Downloads/datasets")
PROJECT_DIR  = Path("C:/Users/FARES/Downloads/trackify-eye-main")
OUTPUT_DIR   = PROJECT_DIR / "merged_dataset"

TARGET = {
    "person":    0,
    "phone_use": 1,
    "sleeping":  2,
    "talking":   3,
    "cheating":  4,
    "fighting":  5,
    "eating":    6,
    "drinking":  7,
}

stats = Counter()
added = 0


def find_image(images_dir, stem):
    for ext in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]:
        p = images_dir / (stem + ext)
        if p.exists():
            return p
    return None


def copy_pair(img_path, label_lines, dst_split, prefix):
    global added
    dst_img = OUTPUT_DIR / dst_split / "images" / f"{prefix}_{img_path.name}"
    dst_lbl = OUTPUT_DIR / dst_split / "labels" / f"{prefix}_{img_path.stem}.txt"
    shutil.copy2(img_path, dst_img)
    dst_lbl.write_text("\n".join(label_lines) + "\n", encoding="utf-8")
    added += 1


def process_split(name, src_dir, dst_split, class_map):
    src_labels = Path(src_dir) / "labels"
    src_images = Path(src_dir) / "images"
    if not src_labels.exists() or not src_images.exists():
        return 0
    count = 0
    for label_file in sorted(src_labels.glob("*.txt")):
        content = label_file.read_text(encoding="utf-8").strip()
        if not content:
            continue
        new_lines = []
        for line in content.split("\n"):
            parts = line.strip().split()
            if len(parts) != 5:
                continue
            src_cls = int(parts[0])
            target_name = class_map.get(src_cls)
            if target_name is None:
                continue
            target_id = TARGET[target_name]
            cx, cy, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
            if w > 0.005 and h > 0.005:
                new_lines.append(f"{target_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
                stats[target_id] += 1
        if new_lines:
            img = find_image(src_images, label_file.stem)
            if img:
                copy_pair(img, new_lines, dst_split, name)
                count += 1
    return count


def main():
    print("=" * 55)
    print("  Adding D9 + D10 to existing merged_dataset")
    print("=" * 55)

    if not OUTPUT_DIR.exists():
        print("ERROR: merged_dataset/ not found. Run merge_all_datasets.py first.")
        sys.exit(1)

    # Count existing images before
    before = {s: len(list((OUTPUT_DIR / s / "images").glob("*"))) for s in ["train", "val", "test"]}

    # ── D9: Mobile Phone Detection ─────────────────────────────
    print("\n── D9: Mobile Phone Detection ──")
    src9 = DATASETS_DIR / "D9"
    if not src9.exists():
        print("  SKIP: C:/Users/FARES/Downloads/datasets/D9 not found")
    else:
        class_map9 = {0: "phone_use"}
        t = process_split("D9", src9 / "train", "train", class_map9)
        v = process_split("D9", src9 / "valid", "val",   class_map9)
        e = process_split("D9", src9 / "test",  "test",  class_map9)
        print(f"  Added: {t} train, {v} val, {e} test")

    # ── D10: Mobile Phones (Phone / Smartwatch / Watch) ────────
    print("\n── D10: Mobile Phones ──")
    src10 = DATASETS_DIR / "D10"
    if not src10.exists():
        print("  SKIP: C:/Users/FARES/Downloads/datasets/D10 not found")
    else:
        class_map10 = {0: "phone_use"}   # 0=Phone, 1=Smartwatch(skip), 2=Watch(skip)
        t = process_split("D10", src10 / "train", "train", class_map10)
        v = process_split("D10", src10 / "valid", "val",   class_map10)
        e = process_split("D10", src10 / "test",  "test",  class_map10)
        print(f"  Added: {t} train, {v} val, {e} test")

    # Summary
    after = {s: len(list((OUTPUT_DIR / s / "images").glob("*"))) for s in ["train", "val", "test"]}
    print(f"\n{'='*55}")
    print(f"  DONE — {added} new images added")
    for s in ["train", "val", "test"]:
        print(f"  {s:5s}: {before[s]} → {after[s]} images (+{after[s]-before[s]})")
    print(f"  New phone_use annotations: {stats.get(1, 0)}")
    print(f"\n  Next step: python train.py")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
