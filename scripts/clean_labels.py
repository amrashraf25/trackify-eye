"""
clean_labels.py — Validates and cleans YOLO label files in merged dataset.

Removes:
  - Degenerate bounding boxes (too small)
  - Out-of-range class IDs
  - Malformed lines (wrong number of fields)
  - Out-of-bounds coordinates
  - Duplicate annotations on same bbox

Usage:
    python clean_labels.py [path_to_labels_dir]
    python clean_labels.py                          # defaults to ./merged_dataset/train/labels
"""
import sys
import hashlib
from pathlib import Path

NUM_CLASSES = 8
MIN_SIZE = 0.005       # Minimum bbox dimension (0.5% of image)
MIN_AREA = 0.0001      # Minimum bbox area (0.01% of image)
DUPLICATE_THRESH = 0.01  # Bbox coords within this range = duplicate


def clean(labels_dir: str):
    labels_path = Path(labels_dir)
    if not labels_path.exists():
        print(f"ERROR: {labels_path} does not exist")
        sys.exit(1)

    stats = {
        "files_processed": 0,
        "files_modified": 0,
        "total_annotations": 0,
        "removed_malformed": 0,
        "removed_class_oob": 0,
        "removed_tiny": 0,
        "removed_oob_coords": 0,
        "removed_duplicate": 0,
        "kept": 0,
    }

    for f in sorted(labels_path.glob("*.txt")):
        stats["files_processed"] += 1
        content = f.read_text(encoding="utf-8").strip()
        if not content:
            continue

        lines = content.split("\n")
        clean_lines = []
        seen = set()

        for line in lines:
            line = line.strip()
            if not line:
                continue

            stats["total_annotations"] += 1
            parts = line.split()

            # Check format: class_id cx cy w h
            if len(parts) != 5:
                stats["removed_malformed"] += 1
                continue

            try:
                cls = int(parts[0])
                cx, cy, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
            except ValueError:
                stats["removed_malformed"] += 1
                continue

            # Check class ID range
            if cls < 0 or cls >= NUM_CLASSES:
                stats["removed_class_oob"] += 1
                continue

            # Check coordinates in valid range [0, 1]
            if not (0 <= cx <= 1 and 0 <= cy <= 1 and 0 < w <= 1 and 0 < h <= 1):
                stats["removed_oob_coords"] += 1
                continue

            # Check minimum size
            if w < MIN_SIZE or h < MIN_SIZE or (w * h) < MIN_AREA:
                stats["removed_tiny"] += 1
                continue

            # Check for near-duplicates
            key = f"{cls}_{round(cx, 2)}_{round(cy, 2)}_{round(w, 2)}_{round(h, 2)}"
            if key in seen:
                stats["removed_duplicate"] += 1
                continue
            seen.add(key)

            clean_lines.append(f"{cls} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
            stats["kept"] += 1

        # Write cleaned file
        new_content = "\n".join(clean_lines) + "\n" if clean_lines else ""
        if new_content != content + "\n" and new_content != content:
            f.write_text(new_content, encoding="utf-8")
            stats["files_modified"] += 1

    # Report
    removed = (stats["removed_malformed"] + stats["removed_class_oob"] +
               stats["removed_tiny"] + stats["removed_oob_coords"] +
               stats["removed_duplicate"])

    print(f"\n{'='*55}")
    print(f"  Label Cleaning Report: {labels_dir}")
    print(f"{'='*55}")
    print(f"  Files processed:     {stats['files_processed']}")
    print(f"  Files modified:      {stats['files_modified']}")
    print(f"  Total annotations:   {stats['total_annotations']}")
    print(f"{'─'*55}")
    print(f"  Kept:                {stats['kept']}")
    print(f"  Removed (total):     {removed}")
    print(f"    - Malformed:       {stats['removed_malformed']}")
    print(f"    - Class OOB:       {stats['removed_class_oob']}")
    print(f"    - Too tiny:        {stats['removed_tiny']}")
    print(f"    - OOB coords:      {stats['removed_oob_coords']}")
    print(f"    - Duplicates:      {stats['removed_duplicate']}")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "./merged_dataset/train/labels"
    clean(path)
