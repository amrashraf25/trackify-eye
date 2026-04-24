"""
remap_labels.py — Converts each dataset's YOLO class IDs to unified Trackify classes.

Usage:
    python remap_labels.py <dataset_name> <src_split_dir> <dst_split_dir>

Example:
    python remap_labels.py D3_student_behavior_burak ./datasets/D3/train ./merged_dataset/train
    python remap_labels.py D3_student_behavior_burak ./datasets/D3/valid ./merged_dataset/val

IMPORTANT: Before running, open each dataset's data.yaml and verify the class ID order.
           The DATASET_MAPS below assume a specific ordering — adjust if yours differs.
"""
import os
import sys
import shutil
from pathlib import Path

# ── Unified target classes (must match data.yaml) ────────────────────
TARGET_CLASSES = {
    "person":    0,
    "phone_use": 1,
    "sleeping":  2,
    "talking":   3,
    "cheating":  4,
    "fighting":  5,
    "eating":    6,
    "drinking":  7,
}

# ── Per-dataset source class ID → target class name (None = discard) ─
# !! VERIFY these IDs against each dataset's data.yaml before running !!
DATASET_MAPS = {
    "D1_student_with_phone": {
        # Adjust after checking D1's data.yaml
        0: "phone_use",
        1: "person",
    },
    "D2_employee_performance": {
        0: None,          # At-Desk-NotWorking → discard
        1: None,          # At-Desk-Working → discard
        2: "sleeping",    # Sleeping → keep
        3: None,          # Standing-NotWorking → discard
        4: None,          # Standing-Working → discard
        5: None,          # Walking → discard
    },
    "D3_student_behavior_burak": {
        0: "cheating",    # don't listening → cheating
        1: None,          # listening → discard
        2: "phone_use",   # looking at phone
        3: "sleeping",    # sleeping
    },
    "D4_classroom_attitude": {
        # !! MUST verify — class order unknown !!
        0: "sleeping",
        1: "talking",
        2: "phone_use",
        3: "cheating",
        4: None,          # attention/normal → discard
    },
    "D5_student_action_recognition": {
        # Use as holdout validation — remap only matching classes
        0: "sleeping",
        1: "phone_use",
        2: None,          # reading → discard
        3: None,          # writing → discard
        4: None,          # hand_raise → discard
    },
    "D7_fight_detection_ezgi": {
        0: "fighting",
        1: None,          # no_fight → discard
    },
    "D8_fight_ningbo": {
        0: None,          # fall → discard
        1: "fighting",
        2: None,          # jump → discard
        3: "person",
        4: None,          # stand → discard
    },
}


def remap_dataset(dataset_name: str, src_dir: str, dst_dir: str):
    mapping = DATASET_MAPS.get(dataset_name)
    if mapping is None:
        print(f"ERROR: Unknown dataset '{dataset_name}'")
        print(f"Available: {', '.join(DATASET_MAPS.keys())}")
        sys.exit(1)

    src_labels = Path(src_dir) / "labels"
    src_images = Path(src_dir) / "images"
    dst_labels = Path(dst_dir) / "labels"
    dst_images = Path(dst_dir) / "images"

    if not src_labels.exists():
        print(f"ERROR: {src_labels} does not exist")
        sys.exit(1)

    dst_labels.mkdir(parents=True, exist_ok=True)
    dst_images.mkdir(parents=True, exist_ok=True)

    kept = 0
    discarded = 0
    images_copied = 0

    for label_file in sorted(src_labels.glob("*.txt")):
        new_lines = []
        for line in label_file.read_text(encoding="utf-8").strip().split("\n"):
            if not line.strip():
                continue
            parts = line.strip().split()
            if len(parts) < 5:
                discarded += 1
                continue

            src_cls = int(parts[0])
            target_name = mapping.get(src_cls)

            if target_name is None:
                discarded += 1
                continue

            target_id = TARGET_CLASSES[target_name]
            new_lines.append(f"{target_id} {' '.join(parts[1:])}")
            kept += 1

        if not new_lines:
            continue

        # Find matching image
        for ext in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]:
            img_path = src_images / (label_file.stem + ext)
            if img_path.exists():
                # Prefix with dataset name to avoid filename collisions
                dst_img_name = f"{dataset_name}_{img_path.name}"
                dst_lbl_name = f"{dataset_name}_{label_file.name}"

                shutil.copy2(img_path, dst_images / dst_img_name)
                (dst_labels / dst_lbl_name).write_text(
                    "\n".join(new_lines) + "\n", encoding="utf-8"
                )
                images_copied += 1
                break

    print(f"\n{'='*50}")
    print(f"  Dataset:    {dataset_name}")
    print(f"  Source:     {src_dir}")
    print(f"  Dest:       {dst_dir}")
    print(f"  Kept:       {kept} annotations")
    print(f"  Discarded:  {discarded} annotations")
    print(f"  Images:     {images_copied} copied")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python remap_labels.py <dataset_name> <src_split_dir> <dst_split_dir>")
        print("Example: python remap_labels.py D3_student_behavior_burak ./datasets/D3/train ./merged_dataset/train")
        sys.exit(1)

    remap_dataset(sys.argv[1], sys.argv[2], sys.argv[3])
