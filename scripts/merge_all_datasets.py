"""
merge_all_datasets.py — Complete pipeline to merge all Trackify datasets.

Handles:
  - D1: Polygon→bbox conversion (segmentation format → detection format)
  - D2: Extract Sleeping class only
  - D3: Extract Sleeping + Turning_Around
  - D4: Remap 16 classes to unified 8-class system (THE GOLD MINE)
  - D7: Fight data (auto-splits test-only set into train/valid/test)
  - D8: Fight data (small supplement)

Usage:
    python merge_all_datasets.py

    Expects datasets at: C:/Users/FARES/Downloads/datasets/
    Output goes to:      C:/Users/FARES/Downloads/trackify-eye-main/merged_dataset/
"""
import os
import sys
import shutil
import random
from pathlib import Path
from collections import Counter

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

random.seed(42)  # Reproducible splits

# ── Paths ──────────────────────────────────────────────────────────────
DATASETS_DIR = Path("C:/Users/FARES/Downloads/datasets")
PROJECT_DIR  = Path("C:/Users/FARES/Downloads/trackify-eye-main")
OUTPUT_DIR   = PROJECT_DIR / "merged_dataset"

# ── Unified target classes ─────────────────────────────────────────────
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

# ── Stats tracking ─────────────────────────────────────────────────────
global_stats = Counter()   # class_id → annotation count
images_copied = 0


def ensure_dirs():
    for split in ["train", "val", "test"]:
        (OUTPUT_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (OUTPUT_DIR / split / "labels").mkdir(parents=True, exist_ok=True)


def polygon_to_bbox(coords):
    """Convert polygon coordinates (x1,y1,x2,y2,...) to bbox (cx,cy,w,h)."""
    xs = coords[0::2]
    ys = coords[1::2]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    cx = (x_min + x_max) / 2
    cy = (y_min + y_max) / 2
    w = x_max - x_min
    h = y_max - y_min
    return cx, cy, w, h


def find_image(images_dir, stem):
    """Find image file matching label stem."""
    for ext in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]:
        p = images_dir / (stem + ext)
        if p.exists():
            return p
    return None


def copy_pair(img_path, label_lines, dst_split, prefix):
    """Copy image + write label to output directory."""
    global images_copied
    dst_img_name = f"{prefix}_{img_path.name}"
    dst_lbl_name = f"{prefix}_{img_path.stem}.txt"

    shutil.copy2(img_path, OUTPUT_DIR / dst_split / "images" / dst_img_name)
    (OUTPUT_DIR / dst_split / "labels" / dst_lbl_name).write_text(
        "\n".join(label_lines) + "\n", encoding="utf-8"
    )
    images_copied += 1


def process_split(dataset_name, src_dir, dst_split, class_map, is_polygon=False):
    """Process one split (train/valid/test) of a dataset."""
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
            if not line.strip():
                continue
            parts = line.strip().split()
            try:
                src_cls = int(parts[0])
            except ValueError:
                continue  # corrupted label line — skip
            target_name = class_map.get(src_cls)
            if target_name is None:
                continue

            target_id = TARGET[target_name]

            if is_polygon and len(parts) > 5:
                # Convert polygon to bbox
                coords = [float(x) for x in parts[1:]]
                if len(coords) >= 4:
                    cx, cy, w, h = polygon_to_bbox(coords)
                    if w > 0.005 and h > 0.005:  # Skip tiny boxes
                        new_lines.append(f"{target_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
                        global_stats[target_id] += 1
            elif len(parts) == 5:
                # Standard YOLO bbox format
                cx, cy, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
                if w > 0.005 and h > 0.005:
                    new_lines.append(f"{target_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
                    global_stats[target_id] += 1

        if new_lines:
            img = find_image(src_images, label_file.stem)
            if img:
                copy_pair(img, new_lines, dst_split, dataset_name)
                count += 1

    return count


def process_d1():
    """D1: Student with Phone — POLYGON format, single class → phone_use"""
    print("\n── D1: Student with Phone ──")
    src = DATASETS_DIR / "D1"
    if not src.exists():
        print("  SKIP: D1 not found")
        return

    class_map = {0: "phone_use"}
    t = process_split("D1", src / "train", "train", class_map, is_polygon=True)
    v = process_split("D1", src / "valid", "val", class_map, is_polygon=True)
    e = process_split("D1", src / "test", "test", class_map, is_polygon=True)
    print(f"  Copied: {t} train, {v} val, {e} test (polygon→bbox converted)")


def process_d2():
    """D2: Employee Performance — extract Sleeping ONLY"""
    print("\n── D2: Employee Performance (Sleeping only) ──")
    src = DATASETS_DIR / "D2_v3"
    if not src.exists():
        print("  SKIP: D2_v3 not found")
        return

    # 0: At-Desk-NotWorking → skip
    # 1: At-Desk-Working → skip
    # 2: Sleeping → sleeping
    # 3: Standing-NotWorking → skip
    # 4: Standing-Working → skip
    # 5: Walking → skip
    class_map = {2: "sleeping"}
    t = process_split("D2", src / "train", "train", class_map)
    v = process_split("D2", src / "valid", "val", class_map)
    e = process_split("D2", src / "test", "test", class_map)
    print(f"  Copied: {t} train, {v} val, {e} test (Sleeping class only)")


def process_d3():
    """D3: Student Behavior Detection (Burak) — Sleeping + Turning_Around"""
    print("\n── D3: Student Behavior (Burak) ──")
    src = DATASETS_DIR / "D3"
    if not src.exists():
        print("  SKIP: D3 not found")
        return

    # 0: Looking_Forward → skip
    # 1: Raising_Hand → skip
    # 2: Reading → skip
    # 3: Sleeping → sleeping
    # 4: Turning_Around → cheating
    class_map = {3: "sleeping", 4: "cheating"}
    t = process_split("D3", src / "train", "train", class_map)
    v = process_split("D3", src / "valid", "val", class_map)
    e = process_split("D3", src / "test", "test", class_map)
    print(f"  Copied: {t} train, {v} val, {e} test")


def process_d4():
    """D4: Classroom Attitude — THE GOLD MINE, 16 classes remapped"""
    print("\n── D4: Classroom Attitude (16→6 classes) ──")
    src = DATASETS_DIR / "D4_v3"
    if not src.exists():
        print("  SKIP: D4_v3 not found")
        return

    # 0:  Cheating       → cheating
    # 1:  CheatingDevice → skip (device, not person behavior)
    # 2:  Exam Device    → skip
    # 3:  Leaning Down   → sleeping (head down posture)
    # 4:  Leaving Seat   → skip
    # 5:  Looking around → cheating (looking away from exam/class)
    # 6:  Phone          → phone_use
    # 7:  Phone use      → phone_use
    # 8:  Sleeping       → sleeping
    # 9:  Standing       → skip
    # 10: Turning head   → cheating
    # 11: Turning_Around → cheating
    # 12: Walking        → skip
    # 13: cell-phones    → phone_use
    # 14: invigilator    → skip (teacher, not student behavior)
    # 15: person         → person
    class_map = {
        0:  "cheating",
        3:  "sleeping",
        5:  "cheating",
        6:  "phone_use",
        7:  "phone_use",
        8:  "sleeping",
        10: "cheating",
        11: "cheating",
        13: "phone_use",
        15: "person",
    }
    t = process_split("D4", src / "train", "train", class_map)
    v = process_split("D4", src / "valid", "val", class_map)
    e = process_split("D4", src / "test", "test", class_map)
    print(f"  Copied: {t} train, {v} val, {e} test")


def process_d7():
    """D7: Fight Detection — may have test-only split, needs manual splitting"""
    print("\n── D7: Fight Detection ──")

    class_map = {0: "fighting"}  # 0: fight → fighting, 1: non-fight/normal → skip

    # Try to find a version with actual train labels
    src = None
    for candidate in ["D7_v1", "D7_v2"]:
        p = DATASETS_DIR / candidate
        if (p / "train" / "labels").exists() and len(list((p / "train" / "labels").glob("*.txt"))) > 0:
            src = p
            print(f"  Using {candidate} (has train labels)")
            t = process_split("D7", src / "train", "train", class_map)
            v = process_split("D7", src / "valid", "val", class_map)
            e = process_split("D7", src / "test", "test", class_map)
            print(f"  Copied: {t} train, {v} val, {e} test")
            return

    # Fallback: find version with test labels and manually split 70/20/10
    src = DATASETS_DIR / "D7_v2"
    if not src.exists():
        print("  SKIP: D7 not found")
        return

    test_labels = src / "test" / "labels"
    test_images = src / "test" / "images"
    if not test_labels.exists() or len(list(test_labels.glob("*.txt"))) == 0:
        print("  SKIP: D7_v2 has no labels")
        return

    print(f"  Using D7_v2 (test-only → splitting 70/20/10)")
    label_files = sorted(test_labels.glob("*.txt"))
    random.shuffle(label_files)

    n = len(label_files)
    train_end = int(n * 0.7)
    val_end = int(n * 0.9)

    splits = {
        "train": label_files[:train_end],
        "val":   label_files[train_end:val_end],
        "test":  label_files[val_end:],
    }

    for split_name, files in splits.items():
        count = 0
        for label_file in files:
            content = label_file.read_text(encoding="utf-8").strip()
            if not content:
                continue
            new_lines = []
            for line in content.split("\n"):
                if not line.strip():
                    continue
                parts = line.strip().split()
                if len(parts) != 5:
                    continue
                src_cls = int(parts[0])
                target_name = class_map.get(src_cls)
                if target_name is None:
                    continue
                target_id = TARGET[target_name]
                new_lines.append(f"{target_id} {' '.join(parts[1:])}")
                global_stats[target_id] += 1

            if new_lines:
                img = find_image(test_images, label_file.stem)
                if img:
                    copy_pair(img, new_lines, split_name, "D7")
                    count += 1
        print(f"    {split_name}: {count} images")


def process_d8():
    """D8: Fight (Ningbo University) — small supplement"""
    print("\n── D8: Fight (Ningbo University) ──")
    src = DATASETS_DIR / "D8"
    if not src.exists():
        print("  SKIP: D8 not found")
        return

    # 0: fight → fighting, 1: normal → skip
    class_map = {0: "fighting"}
    t = process_split("D8", src / "train", "train", class_map)
    v = process_split("D8", src / "valid", "val", class_map)
    e = process_split("D8", src / "test", "test", class_map)
    print(f"  Copied: {t} train, {v} val, {e} test")


def process_d9():
    """D9: Mobile Phone Detection (Roboflow/tusker-ai) — class 0 = phone only.
    Capped to ~5000 train images to avoid overwhelming other classes."""
    print("\n── D9: Mobile Phone Detection ──")
    src = DATASETS_DIR / "D9"
    if not src.exists():
        print("  SKIP: D9 not found")
        return

    # names: ['0', '1'] — class 0 is phone, class 1 is noise (3 annotations, skip)
    class_map = {0: "phone_use"}

    # D9 has ~20k train images — cap to 5000 to keep dataset balanced
    MAX_TRAIN = 5000
    train_labels = sorted((src / "train" / "labels").glob("*.txt"))
    if len(train_labels) > MAX_TRAIN:
        random.shuffle(train_labels)
        # Create a temp subset by only processing a random sample
        print(f"  Capping train from {len(train_labels)} → {MAX_TRAIN} images")
        subset_dir = OUTPUT_DIR / "_tmp_d9_train"
        (subset_dir / "labels").mkdir(parents=True, exist_ok=True)
        (subset_dir / "images").mkdir(parents=True, exist_ok=True)
        for lf in train_labels[:MAX_TRAIN]:
            shutil.copy2(lf, subset_dir / "labels" / lf.name)
            img = find_image(src / "train" / "images", lf.stem)
            if img:
                shutil.copy2(img, subset_dir / "images" / img.name)
        t = process_split("D9", subset_dir, "train", class_map)
        shutil.rmtree(subset_dir)
    else:
        t = process_split("D9", src / "train", "train", class_map)

    v = process_split("D9", src / "valid", "val",   class_map)
    e = process_split("D9", src / "test",  "test",  class_map)
    print(f"  Copied: {t} train, {v} val, {e} test")


def process_d10():
    """D10: Mobile Phones (Roboflow/cheating-ai-grad) — Phone/Smartwatch/Watch, phone only."""
    print("\n── D10: Mobile Phones ──")
    src = DATASETS_DIR / "D10"
    if not src.exists():
        print("  SKIP: D10 not found")
        return

    # names: ['Phone', 'Smartwatch', 'Watch']
    # 0: Phone     → phone_use
    # 1: Smartwatch → skip
    # 2: Watch      → skip
    class_map = {0: "phone_use"}

    t = process_split("D10", src / "train", "train", class_map)
    v = process_split("D10", src / "valid", "val",   class_map)
    e = process_split("D10", src / "test",  "test",  class_map)
    print(f"  Copied: {t} train, {v} val, {e} test")


def write_data_yaml():
    """Write the unified data.yaml config."""
    yaml_content = f"""# Trackify Behavior Detection — Unified Merged Dataset
# Auto-generated by merge_all_datasets.py

path: {OUTPUT_DIR.as_posix()}
train: train/images
val: val/images
test: test/images

nc: 8
names:
  0: person
  1: phone_use
  2: sleeping
  3: talking
  4: cheating
  5: fighting
  6: eating
  7: drinking
"""
    (OUTPUT_DIR / "data.yaml").write_text(yaml_content, encoding="utf-8")
    print(f"\n  data.yaml written to {OUTPUT_DIR / 'data.yaml'}")


def print_summary():
    """Print final class distribution."""
    names = {0: "person", 1: "phone_use", 2: "sleeping", 3: "talking",
             4: "cheating", 5: "fighting", 6: "eating", 7: "drinking"}

    print(f"\n{'='*60}")
    print(f"  FINAL MERGED DATASET")
    print(f"{'='*60}")

    # Count images per split
    for split in ["train", "val", "test"]:
        imgs = list((OUTPUT_DIR / split / "images").glob("*"))
        print(f"  {split:5s}: {len(imgs)} images")

    print(f"\n{'─'*60}")
    print(f"  CLASS DISTRIBUTION (all splits combined)")
    print(f"{'─'*60}")

    max_count = max(global_stats.values()) if global_stats else 1
    for cls_id in sorted(names):
        name = names[cls_id]
        count = global_stats.get(cls_id, 0)
        bar_len = int((count / max_count) * 30) if max_count > 0 else 0
        bar = "█" * bar_len

        flag = ""
        if count == 0:
            flag = " ✗ MISSING (COCO fallback)"
        elif count < 200:
            flag = " ⚠ LOW — needs more data"
        elif count < 500:
            flag = " ~ OK but could use more"

        print(f"  {cls_id} {name:12s}: {count:5d}  {bar}{flag}")

    total = sum(global_stats.values())
    print(f"{'─'*60}")
    print(f"  Total annotations: {total}")
    print(f"  Total images:      {images_copied}")
    print(f"{'='*60}")


def main():
    print("╔════════════════════════════════════════════════╗")
    print("║   Trackify Dataset Merger                     ║")
    print("║   Merging all datasets → unified 8-class set  ║")
    print("╚════════════════════════════════════════════════╝")

    # Clean output directory
    if OUTPUT_DIR.exists():
        print(f"\n  Cleaning existing {OUTPUT_DIR}...")
        shutil.rmtree(OUTPUT_DIR)

    ensure_dirs()

    # Process each dataset
    process_d1()
    process_d2()
    process_d3()
    process_d4()
    process_d7()
    process_d8()
    process_d9()
    process_d10()

    # Write config
    write_data_yaml()

    # Summary
    print_summary()

    print(f"\n  ✓ Merged dataset ready at: {OUTPUT_DIR}")
    print(f"  Next: python scripts/train_model.py base")


if __name__ == "__main__":
    main()
