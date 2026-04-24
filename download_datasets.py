"""
╔══════════════════════════════════════════════════════════════════════╗
║         TRACKIFY — FULL DATASET AUTO-DOWNLOADER                     ║
║  Downloads all datasets needed for the complete behavior AI system  ║
╚══════════════════════════════════════════════════════════════════════╝

Run:   python download_datasets.py
       python download_datasets.py --only scb
       python download_datasets.py --only kaggle
       python download_datasets.py --list
"""

import os, sys, subprocess, zipfile, shutil, argparse, json
from pathlib import Path

# ── Output directory ──────────────────────────────────────────────────
BASE = Path(__file__).parent / "datasets"
BASE.mkdir(exist_ok=True)

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):   print(f"  {GREEN}✓{RESET}  {msg}")
def warn(msg): print(f"  {YELLOW}⚠{RESET}  {msg}")
def err(msg):  print(f"  {RED}✗{RESET}  {msg}")
def info(msg): print(f"  {CYAN}→{RESET}  {msg}")
def head(msg): print(f"\n{BOLD}{CYAN}━━━ {msg} ━━━{RESET}")


# ════════════════════════════════════════════════════════════════════════
#  HELPER: run shell command
# ════════════════════════════════════════════════════════════════════════

def run(cmd, cwd=None, capture=False):
    try:
        r = subprocess.run(cmd, shell=True, cwd=cwd,
                           capture_output=capture, text=True)
        return r.returncode == 0, r.stdout
    except Exception as e:
        return False, str(e)


def check_tool(name):
    ok_flag, _ = run(f"{name} --version", capture=True)
    return ok_flag


def pip_install(*pkgs):
    for pkg in pkgs:
        run(f"{sys.executable} -m pip install {pkg} --quiet")


# ════════════════════════════════════════════════════════════════════════
#  DATASET 1 — SCB (Student Classroom Behavior) — GitHub clone
# ════════════════════════════════════════════════════════════════════════

def download_scb():
    head("SCB Dataset — Student Classroom Behavior (GitHub)")
    print("  Covers: phone, sleeping, eating, writing, raising hand, talking")
    print("  Format: YOLO annotations, ~10k labeled images\n")

    dest = BASE / "scb_dataset"
    if dest.exists():
        ok(f"Already downloaded → {dest}")
        return True

    if not check_tool("git"):
        err("Git not installed. Install from https://git-scm.com/downloads")
        return False

    info("Cloning from GitHub (may take a few minutes)...")
    ok_flag, _ = run(f"git clone https://github.com/Whiffe/SCB-dataset \"{dest}\"")
    if ok_flag:
        ok(f"SCB Dataset saved → {dest}")
        _write_info(dest, "scb", "YOLO classroom behavior dataset")
        return True
    else:
        err("Git clone failed. Check your internet connection.")
        return False


# ════════════════════════════════════════════════════════════════════════
#  DATASET 2 — CCTV Fight Detection Dataset (GitHub)
# ════════════════════════════════════════════════════════════════════════

def download_cctv_fight():
    head("CCTV Fight Detection Dataset (GitHub)")
    print("  Covers: fights from CCTV cameras — realistic school-like environment")
    print("  Format: video clips labeled fight / no-fight\n")

    dest = BASE / "cctv_fight"
    if dest.exists():
        ok(f"Already downloaded → {dest}")
        return True

    if not check_tool("git"):
        err("Git not installed.")
        return False

    info("Cloning from GitHub...")
    ok_flag, _ = run(f"git clone https://github.com/sayibet/fight-detection-surv-dataset \"{dest}\"")
    if ok_flag:
        ok(f"CCTV Fight Dataset saved → {dest}")
        _write_info(dest, "cctv_fight", "Video fight detection from surveillance cameras")
        return True
    else:
        err("Git clone failed.")
        return False


# ════════════════════════════════════════════════════════════════════════
#  DATASET 3 — Kaggle Datasets (Hockey Fight + Drowsiness)
# ════════════════════════════════════════════════════════════════════════

KAGGLE_DATASETS = [
    {
        "id":   "yassershrief/hockey-fight-videodataset",
        "name": "Hockey Fight Dataset",
        "dest": "hockey_fight",
        "desc": "1000 fight/no-fight hockey videos — great for violence detection training",
    },
    {
        "id":   "rakibuleceruet/drowsiness-prediction-dataset",
        "name": "Drowsiness Dataset",
        "dest": "drowsiness",
        "desc": "Eye closure + head drooping images for sleeping/drowsy detection",
    },
    {
        "id":   "sakshamjn/person-sleeping-detection-dataset",
        "name": "Person Sleeping Dataset",
        "dest": "sleeping_detection",
        "desc": "Sleeping vs awake labeled images, classroom-usable",
    },
]


def setup_kaggle():
    """Check Kaggle credentials and install kaggle CLI."""
    pip_install("kaggle")
    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if kaggle_json.exists():
        ok("Kaggle credentials found")
        return True

    print()
    warn("Kaggle API key not set up. Follow these steps:")
    info("1. Go to: https://www.kaggle.com/settings")
    info("2. Scroll to 'API' section → click 'Create New Token'")
    info("3. A file 'kaggle.json' will download")
    info(f"4. Move it to: {kaggle_json}")
    info("5. Re-run this script")
    print()
    return False


def download_kaggle():
    head("Kaggle Datasets — Hockey Fight + Drowsiness + Sleeping")

    if not setup_kaggle():
        return False

    all_ok = True
    for ds in KAGGLE_DATASETS:
        dest = BASE / ds["dest"]
        if dest.exists():
            ok(f"{ds['name']} — already downloaded → {dest}")
            continue

        info(f"Downloading {ds['name']}...")
        dest.mkdir(exist_ok=True)
        ok_flag, _ = run(
            f"kaggle datasets download -d \"{ds['id']}\" --path \"{dest}\" --unzip",
            capture=True
        )
        if ok_flag:
            ok(f"{ds['name']} → {dest}")
            _write_info(dest, ds["dest"], ds["desc"])
        else:
            err(f"Failed: {ds['name']}")
            shutil.rmtree(dest, ignore_errors=True)
            all_ok = False

    return all_ok


# ════════════════════════════════════════════════════════════════════════
#  DATASET 4 — Roboflow Universe (Phone + Behavior)
# ════════════════════════════════════════════════════════════════════════

ROBOFLOW_DATASETS = [
    {
        "workspace": "roboflow-100",
        "project":   "cell-phone-detection",
        "version":   1,
        "name":      "Cell Phone Detection",
        "dest":      "phone_detection",
        "desc":      "50k+ phone images, YOLO format",
    },
    {
        "workspace": "student-behavior-detection",
        "project":   "student-behavior-detection-yolov8",
        "version":   1,
        "name":      "Student Behavior Detection",
        "dest":      "student_behavior_rf",
        "desc":      "Classroom behavior YOLO dataset from Roboflow",
    },
]


def download_roboflow(api_key=None):
    head("Roboflow Datasets — Phone Detection + Student Behavior")

    if not api_key:
        print()
        warn("Roboflow API key required. Follow these steps:")
        info("1. Sign up (free) at: https://roboflow.com")
        info("2. Go to Settings → API Keys")
        info("3. Copy your API key")
        info("4. Run: python download_datasets.py --roboflow-key YOUR_KEY")
        print()
        return False

    pip_install("roboflow")
    try:
        from roboflow import Roboflow
    except ImportError:
        err("Could not import roboflow after install")
        return False

    rf = Roboflow(api_key=api_key)
    all_ok = True

    for ds in ROBOFLOW_DATASETS:
        dest = BASE / ds["dest"]
        if dest.exists():
            ok(f"{ds['name']} — already downloaded")
            continue

        info(f"Downloading {ds['name']} from Roboflow...")
        try:
            project = rf.workspace(ds["workspace"]).project(ds["project"])
            dataset = project.version(ds["version"]).download("yolov8", location=str(dest))
            ok(f"{ds['name']} → {dest}")
            _write_info(dest, ds["dest"], ds["desc"])
        except Exception as e:
            err(f"Failed: {ds['name']} — {e}")
            warn("Dataset may not exist or workspace name changed — check roboflow.com")
            all_ok = False

    return all_ok


# ════════════════════════════════════════════════════════════════════════
#  DATASET 5 — Manual Download Instructions (requires forms/registration)
# ════════════════════════════════════════════════════════════════════════

MANUAL_DATASETS = [
    {
        "name": "RWF-2000 (Real World Fights — BEST fighting dataset)",
        "why":  "2000 surveillance fight videos. Best for school/campus violence.",
        "url":  "https://github.com/mchengny/RWF2000-Video-Database-for-Violence-Detection",
        "steps": [
            "Go to the GitHub link above",
            "Fill the Google Form linked in the README (takes 30 seconds)",
            "You'll receive a download link by email (usually within minutes)",
            "Download and extract to: datasets/rwf2000/",
        ],
    },
    {
        "name": "Mendeley Student Cheating Detection Dataset",
        "why":  "Eye gaze, head movement, hand interaction during exams.",
        "url":  "https://data.mendeley.com — search: 'student cheating detection'",
        "steps": [
            "Go to https://data.mendeley.com",
            "Search for 'student cheating detection'",
            "Create a free account if needed",
            "Click Download All and extract to: datasets/cheating_mendeley/",
        ],
    },
    {
        "name": "Student Attention Dataset (Mendeley)",
        "why":  "Head pose, gaze, attention level, phone presence.",
        "url":  "https://data.mendeley.com — search: 'student attention classroom'",
        "steps": [
            "Go to https://data.mendeley.com",
            "Search for 'student attention classroom'",
            "Download and extract to: datasets/attention_mendeley/",
        ],
    },
    {
        "name": "HMDB51 — Violence Subset",
        "why":  "Action recognition dataset with fight/push/punch classes.",
        "url":  "https://serre-lab.clps.brown.edu/resource/hmdb-a-large-human-motion-database/",
        "steps": [
            "Go to the URL above",
            "Download hmdb51_org.rar",
            "Extract specific classes: punch, kick, pushup",
            "Put in: datasets/hmdb51_violence/",
        ],
    },
]


def print_manual_instructions():
    head("Manual Downloads Required (cannot auto-download)")
    for ds in MANUAL_DATASETS:
        print(f"\n  {BOLD}{ds['name']}{RESET}")
        print(f"  Why: {ds['why']}")
        print(f"  URL: {CYAN}{ds['url']}{RESET}")
        print(f"  Steps:")
        for i, step in enumerate(ds["steps"], 1):
            print(f"    {i}. {step}")


# ════════════════════════════════════════════════════════════════════════
#  HELPER: write dataset info
# ════════════════════════════════════════════════════════════════════════

def _write_info(dest, key, desc):
    info_file = dest / "dataset_info.json"
    info_file.write_text(json.dumps({"key": key, "description": desc, "format": "yolov8"}, indent=2))


# ════════════════════════════════════════════════════════════════════════
#  POST-DOWNLOAD: Generate combined data.yaml for training
# ════════════════════════════════════════════════════════════════════════

BEHAVIOR_CLASSES = [
    "sleeping", "phone", "eating", "drinking",
    "writing", "raising_hand", "talking", "reading",
    "cheating", "fighting", "normal"
]


def generate_combined_yaml():
    head("Generating combined training config (data.yaml)")
    yaml_content = f"""# Trackify Combined Classroom Behavior Dataset
# Auto-generated by download_datasets.py

path: {BASE}

train: scb_dataset/images/train
val:   scb_dataset/images/val

# {len(BEHAVIOR_CLASSES)} behavior classes
nc: {len(BEHAVIOR_CLASSES)}
names: {BEHAVIOR_CLASSES}

# ─── Dataset sources ─────────────────────────────
# SCB Dataset:     {BASE / 'scb_dataset'}
# Hockey Fight:    {BASE / 'hockey_fight'}
# CCTV Fight:      {BASE / 'cctv_fight'}
# Drowsiness:      {BASE / 'drowsiness'}
# Phone Detection: {BASE / 'phone_detection'}
"""
    yaml_path = BASE / "combined_data.yaml"
    yaml_path.write_text(yaml_content)
    ok(f"Training config → {yaml_path}")


# ════════════════════════════════════════════════════════════════════════
#  TRAINING SCRIPT GENERATOR
# ════════════════════════════════════════════════════════════════════════

def generate_training_script():
    head("Generating YOLOv8 training script")
    script = f'''"""
Trackify — Fine-tune YOLOv8 on classroom behavior datasets
Run: python train_model.py
"""
from ultralytics import YOLO
import torch

# Use GPU if available
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Training on: {{device}}")

# ── Train classroom behavior model (start from YOLOv8n pretrained) ──
model = YOLO("yolov8n.pt")

results = model.train(
    data="{BASE / 'combined_data.yaml'}",
    epochs=100,
    imgsz=640,
    batch=16 if device == "cuda" else 4,
    device=device,
    name="trackify_classroom_v1",
    patience=20,           # early stopping
    save_period=10,        # save every 10 epochs
    augment=True,          # data augmentation
    mixup=0.1,
    copy_paste=0.1,
    degrees=10.0,
    fliplr=0.5,
    hsv_h=0.015,
    hsv_s=0.7,
    hsv_v=0.4,
)

print("\\n✓ Training complete!")
print(f"Best model → runs/detect/trackify_classroom_v1/weights/best.pt")
print("\\nTo use in Trackify backend, update trackify_ai_pipeline.py:")
print("  CLASSROOM_MODEL = 'runs/detect/trackify_classroom_v1/weights/best.pt'")
'''
    script_path = Path(__file__).parent / "train_model.py"
    script_path.write_text(script)
    ok(f"Training script → {script_path}")


# ════════════════════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════════════════════

def print_summary():
    head("Download Summary")
    datasets = list(BASE.iterdir()) if BASE.exists() else []
    downloaded = [d for d in datasets if d.is_dir()]
    if downloaded:
        print(f"\n  {GREEN}Downloaded datasets ({len(downloaded)}):{RESET}")
        for d in downloaded:
            info_file = d / "dataset_info.json"
            desc = ""
            if info_file.exists():
                try: desc = " — " + json.loads(info_file.read_text()).get("description", "")
                except: pass
            print(f"    ✓ {d.name}{desc}")
    print(f"\n  {YELLOW}Manual downloads still needed:{RESET}")
    for ds in MANUAL_DATASETS:
        print(f"    ○ {ds['name']}")
    print(f"\n  {BOLD}Next step → run: python train_model.py{RESET}\n")


def main():
    parser = argparse.ArgumentParser(description="Trackify Dataset Downloader")
    parser.add_argument("--only",          help="Download only: scb | cctv | kaggle | roboflow | manual")
    parser.add_argument("--roboflow-key",  help="Roboflow API key")
    parser.add_argument("--list",          action="store_true", help="List all datasets without downloading")
    args = parser.parse_args()

    print(f"\n{BOLD}{CYAN}{'═'*60}{RESET}")
    print(f"{BOLD}{CYAN}  TRACKIFY DATASET DOWNLOADER{RESET}")
    print(f"{BOLD}{CYAN}{'═'*60}{RESET}")
    print(f"  Output directory: {BASE}\n")

    if args.list:
        for ds in MANUAL_DATASETS:
            print(f"  {ds['name']}: {ds['url']}")
        return

    only = args.only

    if not only or only == "scb":
        download_scb()

    if not only or only == "cctv":
        download_cctv_fight()

    if not only or only == "kaggle":
        download_kaggle()

    if not only or only == "roboflow":
        download_roboflow(args.roboflow_key)

    if not only or only == "manual":
        print_manual_instructions()

    generate_combined_yaml()
    generate_training_script()
    print_summary()


if __name__ == "__main__":
    main()
