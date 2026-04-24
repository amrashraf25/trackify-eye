"""
train_model.py — Full training pipeline for Trackify behavior detection model.

Usage:
    python train_model.py base          # Step 1: Base training on merged dataset
    python train_model.py finetune      # Step 2: Fine-tune on classroom-only data
    python train_model.py evaluate      # Step 3: Evaluate on holdout set
    python train_model.py deploy        # Step 4: Copy best model to project root
    python train_model.py all           # Run full pipeline (base → finetune → evaluate → deploy)
"""
import sys
import shutil
from pathlib import Path

try:
    from ultralytics import YOLO
except ImportError:
    print("ERROR: ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)

# ── Paths ─────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
MERGED_DATA = PROJECT_ROOT / "merged_dataset" / "data.yaml"
CLASSROOM_DATA = PROJECT_ROOT / "classroom_only" / "data.yaml"
HOLDOUT_DATA = PROJECT_ROOT / "holdout_test" / "data.yaml"
OUTPUT_DIR = PROJECT_ROOT / "trackify_training"
DEPLOY_PATH = PROJECT_ROOT / "trackify_behavior.pt"


def step_base():
    """Step 1: Base training on full merged dataset."""
    print("\n" + "=" * 60)
    print("  STEP 1: Base Training")
    print("=" * 60)

    if not MERGED_DATA.exists():
        print(f"ERROR: {MERGED_DATA} not found. Run merge pipeline first.")
        return None

    # Detect GPU vs CPU and adjust settings
    try:
        import torch
        has_gpu = torch.cuda.is_available()
    except Exception:
        has_gpu = False

    if has_gpu:
        base_model = "yolov8s.pt"   # Small model for GPU
        batch_size = 16
        img_size = 640
        epochs = 100
        print(f"  GPU detected — using yolov8s, batch={batch_size}, imgsz={img_size}")
    else:
        base_model = "yolov8n.pt"   # Nano model for CPU (3x faster)
        batch_size = 8
        img_size = 480              # Smaller images = faster
        epochs = 50                 # Fewer epochs on CPU
        print(f"  CPU only — using yolov8n, batch={batch_size}, imgsz={img_size}")
        print(f"  Estimated time: 3-6 hours")

    model = YOLO(base_model)
    results = model.train(
        data=str(MERGED_DATA),
        epochs=epochs,
        batch=batch_size,
        imgsz=img_size,
        patience=15,          # Early stopping
        project=str(OUTPUT_DIR),
        name="base_v1",
        optimizer="AdamW",
        workers=0,            # Windows compatibility
        # Augmentation (good defaults for classroom data)
        hsv_h=0.015,          # Hue variation
        hsv_s=0.7,            # Saturation variation
        hsv_v=0.4,            # Brightness variation ← important for lighting changes
        degrees=5.0,          # Small rotation
        translate=0.1,
        scale=0.3,
        fliplr=0.5,           # Horizontal flip
        flipud=0.0,           # No vertical flip (not realistic)
        mosaic=1.0,           # Mosaic augmentation
        mixup=0.1,            # Light mixup
    )

    best_path = OUTPUT_DIR / "base_v1" / "weights" / "best.pt"
    if best_path.exists():
        print(f"\n  Base model saved: {best_path}")
        return str(best_path)
    else:
        print("\n  ERROR: Training failed — no best.pt produced")
        return None


def step_finetune(base_model_path: str = None):
    """Step 2: Fine-tune on classroom-only data (D3 + D4)."""
    print("\n" + "=" * 60)
    print("  STEP 2: Fine-tune on Classroom Data")
    print("=" * 60)

    if base_model_path is None:
        base_model_path = str(OUTPUT_DIR / "base_v1" / "weights" / "best.pt")

    if not Path(base_model_path).exists():
        print(f"ERROR: Base model not found at {base_model_path}")
        print("Run 'python train_model.py base' first.")
        return None

    if not CLASSROOM_DATA.exists():
        print(f"WARNING: {CLASSROOM_DATA} not found.")
        print("Skipping fine-tune — base model will be used directly.")
        return base_model_path

    try:
        import torch
        has_gpu = torch.cuda.is_available()
    except Exception:
        has_gpu = False

    model = YOLO(base_model_path)
    results = model.train(
        data=str(CLASSROOM_DATA),
        epochs=20 if not has_gpu else 30,
        batch=8 if not has_gpu else 16,
        imgsz=480 if not has_gpu else 640,
        lr0=0.001,            # Lower learning rate for fine-tuning
        lrf=0.01,             # Final LR = lr0 * lrf
        patience=10,
        project=str(OUTPUT_DIR),
        name="finetune_v1",
        workers=0,
        # Less augmentation for fine-tuning (preserve domain signal)
        hsv_v=0.3,
        degrees=3.0,
        mosaic=0.5,
        mixup=0.0,
    )

    best_path = OUTPUT_DIR / "finetune_v1" / "weights" / "best.pt"
    if best_path.exists():
        print(f"\n  Fine-tuned model saved: {best_path}")
        return str(best_path)
    else:
        print("\n  Fine-tuning failed — using base model")
        return base_model_path


def step_evaluate(model_path: str = None):
    """Step 3: Evaluate on holdout test set (D5)."""
    print("\n" + "=" * 60)
    print("  STEP 3: Evaluate on Holdout Set")
    print("=" * 60)

    if model_path is None:
        # Try fine-tuned first, then base
        ft = OUTPUT_DIR / "finetune_v1" / "weights" / "best.pt"
        base = OUTPUT_DIR / "base_v1" / "weights" / "best.pt"
        model_path = str(ft) if ft.exists() else str(base)

    if not Path(model_path).exists():
        print(f"ERROR: Model not found at {model_path}")
        return

    if not HOLDOUT_DATA.exists():
        print(f"WARNING: {HOLDOUT_DATA} not found — skipping evaluation.")
        print(f"To evaluate, create holdout_test/ with D5 data and data.yaml")
        return

    model = YOLO(model_path)
    results = model.val(
        data=str(HOLDOUT_DATA),
        imgsz=640,
        batch=16,
    )

    print(f"\n  Results:")
    print(f"    mAP@50:    {results.box.map50:.3f}")
    print(f"    mAP@50-95: {results.box.map:.3f}")

    if results.box.map50 > 0.55:
        print(f"    ✓ Model generalizes well (mAP@50 > 0.55)")
    elif results.box.map50 > 0.40:
        print(f"    ~ Acceptable generalization — consider more training data")
    else:
        print(f"    ✗ Poor generalization — likely overfitting. Try:")
        print(f"      - More augmentation")
        print(f"      - Fewer fine-tune epochs")
        print(f"      - More diverse training data")


def step_deploy(model_path: str = None):
    """Step 4: Copy best model to project root as trackify_behavior.pt"""
    print("\n" + "=" * 60)
    print("  STEP 4: Deploy Model")
    print("=" * 60)

    if model_path is None:
        ft = OUTPUT_DIR / "finetune_v1" / "weights" / "best.pt"
        base = OUTPUT_DIR / "base_v1" / "weights" / "best.pt"
        model_path = str(ft) if ft.exists() else str(base)

    if not Path(model_path).exists():
        print(f"ERROR: No trained model found at {model_path}")
        return

    shutil.copy2(model_path, DEPLOY_PATH)
    size_mb = DEPLOY_PATH.stat().st_size / (1024 * 1024)
    print(f"  Model deployed: {DEPLOY_PATH} ({size_mb:.1f} MB)")
    print(f"\n  Next: Update trackify_backend.py to load 'trackify_behavior.pt'")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1].lower()

    if cmd == "base":
        step_base()
    elif cmd == "finetune":
        step_finetune()
    elif cmd == "evaluate":
        step_evaluate()
    elif cmd == "deploy":
        step_deploy()
    elif cmd == "all":
        base_path = step_base()
        if base_path:
            ft_path = step_finetune(base_path)
            step_evaluate(ft_path)
            step_deploy(ft_path)
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
