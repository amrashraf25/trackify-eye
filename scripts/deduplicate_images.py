"""
deduplicate_images.py — Find and remove duplicate images across merged datasets.

Uses MD5 hashing to detect exact duplicates.

Usage:
    python deduplicate_images.py [path_to_images_dir] [path_to_labels_dir]
    python deduplicate_images.py  # defaults to ./merged_dataset/train/images + labels
"""
import sys
import hashlib
from pathlib import Path


def hash_file(filepath: Path) -> str:
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def deduplicate(images_dir: str, labels_dir: str):
    images_path = Path(images_dir)
    labels_path = Path(labels_dir)

    if not images_path.exists():
        print(f"ERROR: {images_path} does not exist")
        sys.exit(1)

    # Hash all images
    hash_map = {}  # hash → first file path
    duplicates = []

    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    image_files = sorted(f for f in images_path.iterdir() if f.suffix.lower() in exts)

    print(f"Hashing {len(image_files)} images...")

    for img in image_files:
        h = hash_file(img)
        if h in hash_map:
            duplicates.append((img, hash_map[h]))
        else:
            hash_map[h] = img

    if not duplicates:
        print(f"\nNo duplicates found in {len(image_files)} images.")
        return

    print(f"\nFound {len(duplicates)} duplicate images:")
    for dup, original in duplicates:
        print(f"  DUP: {dup.name}  ←  ORIGINAL: {original.name}")

    # Remove duplicates (keep the first occurrence)
    confirm = input(f"\nRemove {len(duplicates)} duplicates? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        return

    removed = 0
    for dup, _ in duplicates:
        # Remove image
        dup.unlink()

        # Remove matching label file
        label_file = labels_path / (dup.stem + ".txt")
        if label_file.exists():
            label_file.unlink()

        removed += 1

    print(f"\nRemoved {removed} duplicate images + labels.")


if __name__ == "__main__":
    img_dir = sys.argv[1] if len(sys.argv) > 1 else "./merged_dataset/train/images"
    lbl_dir = sys.argv[2] if len(sys.argv) > 2 else "./merged_dataset/train/labels"
    deduplicate(img_dir, lbl_dir)
