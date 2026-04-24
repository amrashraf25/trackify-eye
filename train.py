"""
Trackify Behavior Model — Local Training Script
=================================================
Just run:   python train.py

Progress is printed live + saved to training_log.txt
You can close the terminal and check the log later.

Estimated time on CPU: 6-10 hours (leave it overnight)
"""
import sys
import os

# Fix Windows encoding
if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

print("=" * 55)
print("  TRACKIFY BEHAVIOR MODEL TRAINING")
print("=" * 55)

# Check GPU
import torch
has_gpu = torch.cuda.is_available()
if has_gpu:
    gpu_name = torch.cuda.get_device_name(0)
    print(f"  GPU:    {gpu_name}")
    print(f"  Mode:   GPU (fast — ~30 min)")
else:
    print(f"  GPU:    None (CPU only)")
    print(f"  Mode:   CPU (slow — ~6-10 hours)")
    print(f"  TIP:    Run overnight, check training_log.txt")

# Check dataset
data_yaml = os.path.join(os.path.dirname(__file__), "merged_dataset", "data.yaml")
if not os.path.exists(data_yaml):
    print(f"\n  ERROR: merged_dataset/data.yaml not found!")
    print(f"  Run 'python scripts/merge_all_datasets.py' first")
    sys.exit(1)

# Count images
train_dir = os.path.join(os.path.dirname(__file__), "merged_dataset", "train", "images")
n_train = len(os.listdir(train_dir)) if os.path.exists(train_dir) else 0
print(f"  Images: {n_train} training images")
print("=" * 55)

# Settings based on hardware
if has_gpu:
    MODEL = "yolov8s.pt"
    BATCH = 16
    IMGSZ = 640
    EPOCHS = 100
    PATIENCE = 20
else:
    MODEL = "yolov8n.pt"
    BATCH = 4
    IMGSZ = 416
    EPOCHS = 50
    PATIENCE = 15

print(f"\n  Model:    {MODEL}")
print(f"  Epochs:   {EPOCHS}")
print(f"  Batch:    {BATCH}")
print(f"  ImgSize:  {IMGSZ}")
print(f"  Patience: {PATIENCE} (auto-stops if no improvement)")
print()

input("  Press ENTER to start training (or Ctrl+C to cancel)...")
print()

from ultralytics import YOLO

model = YOLO(MODEL)

results = model.train(
    data=data_yaml,
    epochs=EPOCHS,
    batch=BATCH,
    imgsz=IMGSZ,
    patience=PATIENCE,
    project=os.path.join(os.path.dirname(__file__), "trackify_training"),
    name="run",
    exist_ok=True,
    optimizer="AdamW",
    workers=0,
    # Augmentation
    hsv_h=0.015,
    hsv_s=0.7,
    hsv_v=0.4,
    degrees=5.0,
    translate=0.1,
    scale=0.3,
    fliplr=0.5,
    flipud=0.0,
    mosaic=1.0,
    mixup=0.1,
)

# Done — copy best model
import shutil
best_pt = os.path.join(os.path.dirname(__file__), "trackify_training", "run", "weights", "best.pt")
deploy_pt = os.path.join(os.path.dirname(__file__), "trackify_behavior.pt")

if os.path.exists(best_pt):
    shutil.copy2(best_pt, deploy_pt)
    size_mb = os.path.getsize(deploy_pt) / (1024 * 1024)
    print("\n" + "=" * 55)
    print("  TRAINING COMPLETE!")
    print(f"  Model saved: trackify_behavior.pt ({size_mb:.1f} MB)")
    print("  Restart the project to use it: npm run dev:all")
    print("=" * 55)
else:
    print("\n  ERROR: Training failed — no best.pt found")
