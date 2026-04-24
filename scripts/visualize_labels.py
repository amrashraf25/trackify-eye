"""
visualize_labels.py — Draw bounding boxes on sample images to verify labels.

Opens a window showing images with colored bounding boxes + class names.
Press any key to go to next image. Press 'q' to quit.

Usage:
    python visualize_labels.py                    # 20 random samples from train
    python visualize_labels.py 50                 # 50 random samples
    python visualize_labels.py 10 val             # 10 from validation set
"""
import sys
import random
import cv2
import numpy as np
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MERGED = Path("C:/Users/FARES/Downloads/trackify-eye-main/merged_dataset")

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

COLORS = {
    0: (200, 200, 200),   # person — gray
    1: (0, 165, 255),     # phone_use — orange
    2: (255, 100, 100),   # sleeping — blue
    3: (0, 255, 255),     # talking — yellow
    4: (0, 0, 255),       # cheating — red
    5: (0, 0, 200),       # fighting — dark red
    6: (0, 200, 0),       # eating — green
    7: (200, 200, 0),     # drinking — cyan
}


def draw_labels(img_path, label_path):
    img = cv2.imread(str(img_path))
    if img is None:
        return None

    h, w = img.shape[:2]

    if label_path.exists():
        for line in label_path.read_text().strip().split("\n"):
            if not line.strip():
                continue
            parts = line.strip().split()
            cls = int(parts[0])
            cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])

            # Convert YOLO normalized → pixel coords
            x1 = int((cx - bw / 2) * w)
            y1 = int((cy - bh / 2) * h)
            x2 = int((cx + bw / 2) * w)
            y2 = int((cy + bh / 2) * h)

            color = COLORS.get(cls, (255, 255, 255))
            name = NAMES.get(cls, f"cls_{cls}")

            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

            # Label background
            label = f"{name}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
            cv2.rectangle(img, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
            cv2.putText(img, label, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)

    # Resize for display if too large
    max_dim = 900
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))

    return img


def main():
    n_samples = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    split = sys.argv[2] if len(sys.argv) > 2 else "train"

    images_dir = MERGED / split / "images"
    labels_dir = MERGED / split / "labels"

    if not images_dir.exists():
        print(f"ERROR: {images_dir} not found")
        return

    # Get all images that have labels
    image_files = sorted(images_dir.glob("*"))
    labeled = []
    for img_path in image_files:
        label_path = labels_dir / (img_path.stem + ".txt")
        if label_path.exists():
            content = label_path.read_text().strip()
            if content:
                labeled.append((img_path, label_path))

    if not labeled:
        print("No labeled images found!")
        return

    random.shuffle(labeled)
    samples = labeled[:n_samples]

    # Save annotated images to a preview folder
    out_dir = MERGED.parent / "dataset_preview"
    out_dir.mkdir(exist_ok=True)

    print(f"Saving {len(samples)} annotated samples to: {out_dir}")

    for i, (img_path, label_path) in enumerate(samples):
        img = draw_labels(img_path, label_path)
        if img is None:
            continue

        prefix = img_path.stem.split("_")[0]
        out_name = f"{i+1:02d}_{prefix}_{img_path.stem[-12:]}.jpg"
        cv2.imwrite(str(out_dir / out_name), img)

        # Read label classes for log
        classes = []
        for line in label_path.read_text().strip().split("\n"):
            if line.strip():
                cls = int(line.split()[0])
                classes.append(NAMES.get(cls, f"?{cls}"))
        print(f"  [{i+1:2d}] {prefix:3s} | {', '.join(set(classes)):30s} | {out_name}")

    print(f"\n  Open folder to inspect: {out_dir}")
    print(f"  Check that bounding boxes match the actual objects in each image!")
    print("Done!")


if __name__ == "__main__":
    main()
