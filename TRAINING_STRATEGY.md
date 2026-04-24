# Trackify AI — Behavior Detection Training Strategy

---

## Current System Analysis

### What We Have Now

| Component | Model | What It Detects | Weakness |
|-----------|-------|-----------------|----------|
| `yolov8n.pt` | YOLOv8-nano (COCO pretrained) | person, cell phone, bottle, cup | "cell phone" from COCO is terrible — tiny objects, low recall |
| `scb_bowturnhead.pt` | Custom YOLOv8 (6.2 MB) | BowHead (sleeping), TurnHead (cheating) | Only 2 classes, small dataset, not enough variety |
| MediaPipe Face Mesh | Landmark heuristics | talking (MAR), eye closure, head droop, cheating (head turn) | Rule-based — false positives, no learning |
| InsightFace buffalo_sc | Face recognition | Student identity | Works well, no changes needed |
| Heuristic | Person bbox overlap | Fighting (8+ frames of overlap between 2 person boxes) | Very crude — misses real fights, false-triggers on hugging |

### The Problem

We have **3 separate detection paths** (YOLO generic, SCB custom, MediaPipe heuristic) stitched together with `if/else` logic. Each path has blind spots. The goal is to replace most of this with **one unified custom-trained YOLO model** that directly detects our target behaviors.

---

## 1. Dataset Analysis & Selection

### Dataset Breakdown

| # | Dataset | URL Slug | Est. Images | Key Classes | Quality |
|---|---------|----------|-------------|-------------|---------|
| D1 | Student with Phone | `class-bj4a9/student-with-phone` | ~500–1K | phone_use, student, phone | Focused on our #1 gap |
| D2 | Employee Performance Monitoring | `project-x2uaa/employee-performance-monitoring` | ~1K–2K | Sleeping, At-Desk-NotWorking, At-Desk-Working, Standing-NotWorking, Standing-Working, Walking | Sleeping class is gold; rest is office context |
| D3 | Student Behavior Detection (Burak) | `burak-koyfx/student-behavior-detection` | ~2.2K | not_listening, listening, looking_at_phone, sleeping | Directly classroom-relevant |
| D4 | Classroom Attitude | `nguyenducmanhs-workspace/classroom-attitude` | ~1K–2K | sleeping, talking, using_phone, cheating, attention (estimated) | Classroom-specific, likely the best multi-class set |
| D5 | Student Action Recognition (Namit) | `namit-adhikari-zse4y/student_action_recognition` | ~1K | reading, writing, sleeping, phone_use, hand_raise (estimated) | Supplementary actions |
| D6 | TeacerEye | `yaswanths-workspace-sbbyu/teacereye` | ~500–1K | Classroom behavior (estimated) | Unknown quality — needs manual review before use |
| D7 | Fight Detection (Ezgi) | `ezgis-workspace-oytmf/fight-detection-cdebd` | ~500–1K | fight, no_fight | Binary fight classifier |
| D8 | Fight (Ningbo University) | `ningbo-university/fight-aa8bp` | ~1K+ | fight, person, fall, stand, jump | Multi-class with fight + context |

### Core Datasets (Main Training)

These form the backbone of training. Use them in full.

| Dataset | Role | Why Core |
|---------|------|----------|
| **D3** — Student Behavior Detection (Burak) | Primary multi-behavior set | 2.2K images, 4 classes directly matching our use case (phone, sleeping, listening). Largest classroom-specific set. Proven on Roboflow with a trained model already. |
| **D4** — Classroom Attitude | Primary multi-behavior set | Multiple behavior classes (sleeping, talking, phone, cheating) all in classroom context. This is the closest match to our exact detection targets. |
| **D1** — Student with Phone | Phone detection specialist | Our #1 accuracy gap. COCO's "cell phone" class has <30% recall on real classroom footage. This dataset focuses specifically on phone-in-hand detection in student settings. |
| **D8** — Fight (Ningbo University) | Fighting detection | Multi-class (fight + person + fall) gives the model context. University research quality. Better than binary fight/no-fight because the model learns what "not fighting" looks like too. |

### Supporting Datasets (Fine-tuning / Augmentation)

Use selectively — extract useful classes, discard noise.

| Dataset | Role | Why Supporting (not core) |
|---------|------|--------------------------|
| **D2** — Employee Performance | Sleeping augmentation only | Office setting, not classroom. BUT the "Sleeping" class shows desk-sleeping from different angles/lighting than D3/D4. Extract only `Sleeping` annotations, discard the rest. |
| **D7** — Fight Detection (Ezgi) | Fighting augmentation | Binary (fight/no_fight) is weaker than D8's multi-class. Use as supplementary fighting data if D8 alone isn't enough. |
| **D5** — Student Action Recognition | Validation set | Use as hold-out validation to test generalization. If annotations align with our classes, merge the matching ones. Otherwise keep separate for eval. |

### Skip / Manual Review Required

| Dataset | Decision | Why |
|---------|----------|-----|
| **D6** — TeacerEye | REVIEW FIRST | Unknown class list, unknown quality. Download sample, check 50 images manually. If quality is good and classes match → promote to Core. If not → discard. |

---

## 2. Unified Class List

### Final Target Classes (8 classes)

```yaml
# data.yaml
names:
  0: person
  1: phone_use
  2: sleeping
  3: talking
  4: cheating
  5: fighting
  6: eating
  7: drinking
```

### Label Mapping Table

Every source label from every dataset must map to exactly one of the 8 target classes (or be discarded).

| Source Dataset | Source Label | Maps To | Notes |
|----------------|-------------|---------|-------|
| D1 | phone, using_phone, mobile, phone_use | `phone_use` | |
| D1 | student, person | `person` | |
| D2 | Sleeping | `sleeping` | |
| D2 | At-Desk-NotWorking | DISCARD | Not relevant to classroom |
| D2 | At-Desk-Working | DISCARD | |
| D2 | Standing-NotWorking | DISCARD | |
| D2 | Standing-Working | DISCARD | |
| D2 | Walking | DISCARD | |
| D3 | looking_at_phone | `phone_use` | |
| D3 | sleeping | `sleeping` | |
| D3 | not_listening / don't listening | `cheating` | Student not paying attention — remap cautiously |
| D3 | listening | DISCARD | We don't detect "good" behavior |
| D4 | using_phone / phone | `phone_use` | |
| D4 | sleeping | `sleeping` | |
| D4 | talking | `talking` | |
| D4 | cheating | `cheating` | |
| D4 | attention / listening | DISCARD | |
| D5 | sleeping | `sleeping` | |
| D5 | phone_use / using_phone | `phone_use` | |
| D5 | reading, writing, hand_raise | DISCARD | |
| D7 | fight | `fighting` | |
| D7 | no_fight | DISCARD | |
| D8 | fight | `fighting` | |
| D8 | person | `person` | |
| D8 | fall | DISCARD | Not in our behavior list |
| D8 | stand, jump | DISCARD | |

### Important: What About `eating` and `drinking`?

None of these 8 datasets have eating/drinking classes. Two options:

1. **Keep using COCO fallback** — yolov8n already detects `bottle`, `cup`, `fork`, `spoon` from COCO. The custom model handles behaviors; COCO handles objects. This is what we do now and it works acceptably.

2. **Collect custom data** (~200–300 images) — If eating/drinking accuracy matters, record 10 minutes of classroom footage with students eating/drinking and annotate it. This is a weekend task.

**Recommendation**: Option 1 for now. The custom model replaces phone/sleeping/talking/cheating/fighting detection. Keep yolov8n as a secondary model for object-based detections (bottle, cup).

---

## 3. Dataset Merging Strategy

### Step-by-Step Merge Process

```
Step 1: Download all datasets in YOLOv8 format from Roboflow
        (Export → YOLOv8 → Download zip)

Step 2: Create unified directory structure:
        merged_dataset/
        ├── data.yaml          ← unified class list
        ├── train/
        │   ├── images/
        │   └── labels/
        ├── val/
        │   ├── images/
        │   └── labels/
        └── test/
            ├── images/
            └── labels/

Step 3: Run label remapping script (see below)

Step 4: Copy remapped images + labels into merged dirs

Step 5: Verify with label distribution check
```

### Label Remapping Script

```python
"""
remap_labels.py — Converts each dataset's class IDs to the unified class list.
Run once per dataset before merging.
"""
import os
import shutil
from pathlib import Path

# ── Unified target classes ──────────────────────────────────────
TARGET_CLASSES = {
    "person": 0,
    "phone_use": 1,
    "sleeping": 2,
    "talking": 3,
    "cheating": 4,
    "fighting": 5,
    "eating": 6,
    "drinking": 7,
}

# ── Per-dataset source→target mapping ──────────────────────────
# Key = source class ID (int), Value = target class name (str) or None to discard
DATASET_MAPS = {
    "D1_student_with_phone": {
        # Adjust these IDs after inspecting each dataset's data.yaml
        0: "phone_use",     # phone / using_phone
        1: "person",        # student
    },
    "D2_employee_performance": {
        # Only keep Sleeping — check which ID it is in data.yaml
        0: None,            # At-Desk-NotWorking → discard
        1: None,            # At-Desk-Working → discard
        2: "sleeping",      # Sleeping
        3: None,            # Standing-NotWorking → discard
        4: None,            # Standing-Working → discard
        5: None,            # Walking → discard
    },
    "D3_student_behavior_burak": {
        0: "cheating",      # don't listening / not listening
        1: None,            # listening → discard
        2: "phone_use",     # looking at phone
        3: "sleeping",      # sleeping
    },
    "D4_classroom_attitude": {
        # !! CHECK data.yaml — class IDs will vary !!
        0: "sleeping",
        1: "talking",
        2: "phone_use",
        3: "cheating",
        4: None,            # attention → discard
    },
    "D7_fight_detection_ezgi": {
        0: "fighting",      # fight
        1: None,            # no_fight → discard
    },
    "D8_fight_ningbo": {
        0: None,            # fall → discard
        1: "fighting",      # fight
        2: None,            # jump → discard
        3: "person",        # person
        4: None,            # stand → discard
    },
}


def remap_dataset(dataset_name: str, src_dir: str, dst_dir: str):
    """
    Reads YOLO .txt label files from src_dir/labels/,
    remaps class IDs, writes to dst_dir/labels/.
    Copies matching images to dst_dir/images/.
    """
    mapping = DATASET_MAPS[dataset_name]
    src_labels = Path(src_dir) / "labels"
    src_images = Path(src_dir) / "images"
    dst_labels = Path(dst_dir) / "labels"
    dst_images = Path(dst_dir) / "images"
    dst_labels.mkdir(parents=True, exist_ok=True)
    dst_images.mkdir(parents=True, exist_ok=True)

    kept, discarded, total = 0, 0, 0

    for label_file in src_labels.glob("*.txt"):
        new_lines = []
        for line in label_file.read_text().strip().split("\n"):
            if not line.strip():
                continue
            parts = line.strip().split()
            src_cls = int(parts[0])
            target_name = mapping.get(src_cls)
            if target_name is None:
                discarded += 1
                continue
            target_id = TARGET_CLASSES[target_name]
            new_lines.append(f"{target_id} {' '.join(parts[1:])}")
            kept += 1
            total += 1

        if new_lines:
            # Write remapped label
            (dst_labels / label_file.name).write_text("\n".join(new_lines) + "\n")
            # Copy matching image
            for ext in [".jpg", ".jpeg", ".png"]:
                img = src_images / (label_file.stem + ext)
                if img.exists():
                    # Prefix with dataset name to avoid filename collisions
                    dst_name = f"{dataset_name}_{img.name}"
                    shutil.copy2(img, dst_images / dst_name)
                    # Rename label to match
                    (dst_labels / label_file.name).rename(
                        dst_labels / f"{dataset_name}_{label_file.name}"
                    )
                    break

    print(f"{dataset_name}: kept {kept} annotations, discarded {discarded} from {total + discarded} total")


if __name__ == "__main__":
    import sys
    # Usage: python remap_labels.py D3_student_behavior_burak ./D3/train ./merged/train
    remap_dataset(sys.argv[1], sys.argv[2], sys.argv[3])
```

### After Merging — Verify Distribution

```python
"""
check_distribution.py — Count annotations per class in merged dataset.
"""
from pathlib import Path
from collections import Counter

NAMES = {0: "person", 1: "phone_use", 2: "sleeping", 3: "talking",
         4: "cheating", 5: "fighting", 6: "eating", 7: "drinking"}

counts = Counter()
for f in Path("merged_dataset/train/labels").glob("*.txt"):
    for line in f.read_text().strip().split("\n"):
        if line.strip():
            cls = int(line.split()[0])
            counts[cls] += 1

print("\n=== Class Distribution ===")
for cls_id in sorted(NAMES):
    name = NAMES[cls_id]
    count = counts.get(cls_id, 0)
    bar = "#" * (count // 20)
    print(f"  {cls_id} {name:12s} : {count:5d}  {bar}")

total = sum(counts.values())
print(f"\n  Total annotations: {total}")
print(f"  Total images: {len(list(Path('merged_dataset/train/images').glob('*')))}")
```

### Target Distribution (Healthy Balance)

```
  person     : 3000+   (most images have people in them)
  phone_use  : 1000+   (D1 + D3 + D4 combined)
  sleeping   : 800+    (D2 + D3 + D4 combined)
  talking    : 500+    (D4 primarily)
  cheating   : 500+    (D3 + D4 combined)
  fighting   : 600+    (D7 + D8 combined)
  eating     : 0       (not in these datasets — COCO fallback)
  drinking   : 0       (not in these datasets — COCO fallback)
```

If any class is under 300 annotations → apply augmentation (flip, brightness, crop) or collect more.

---

## 4. Data Cleaning Checklist

### What to Clean (and How)

| Problem | How to Detect | How to Fix |
|---------|---------------|------------|
| **Wrong labels** (phone labeled as person) | Visual spot-check 100 random images per dataset using Roboflow's annotation viewer or `fiftyone` | Manually fix in annotation tool, or discard the image |
| **Missing annotations** (phone visible but not labeled) | Run pretrained yolov8n on all images, compare detections vs labels | Add missing boxes or exclude the image |
| **Duplicate images** | Hash all image files (MD5), flag duplicates | Remove duplicates — keep one copy |
| **Tiny/degenerate bboxes** | Filter: `width < 10px OR height < 10px OR area < 100px` | Delete those annotations (keep image if other valid boxes exist) |
| **Wrong aspect ratio / corrupt images** | `PIL.Image.open(f).verify()` + check dimensions | Delete corrupt files |
| **Label class ID out of range** | Parse all .txt files, check all IDs are 0–7 | Remap or delete the annotation |
| **Cross-dataset label conflicts** | Same visual concept labeled differently across datasets | The remap script (above) handles this |

### Automated Cleaning Script

```python
"""
clean_labels.py — Remove degenerate bounding boxes and validate label format.
"""
from pathlib import Path

MIN_SIZE = 0.005   # Minimum bbox dimension as fraction of image (0.5%)
errors = 0

for f in Path("merged_dataset/train/labels").glob("*.txt"):
    lines = f.read_text().strip().split("\n")
    clean = []
    for line in lines:
        if not line.strip():
            continue
        parts = line.strip().split()
        if len(parts) != 5:
            errors += 1
            continue
        cls, cx, cy, w, h = int(parts[0]), *[float(x) for x in parts[1:]]
        if cls < 0 or cls > 7:
            errors += 1
            continue
        if w < MIN_SIZE or h < MIN_SIZE:
            errors += 1
            continue
        clean.append(line.strip())
    f.write_text("\n".join(clean) + "\n" if clean else "")

print(f"Cleaned {errors} bad annotations")
```

### Cross-Dataset Conflict Resolution Rules

1. **If two datasets label the same visual differently** (e.g., "not_listening" in D3 vs "cheating" in D4):
   - Prefer the more specific/relevant label
   - "not_listening" → `cheating` is a reasonable mapping (student looking away/distracted)
   - Document every mapping decision in comments

2. **If a dataset has a "person" class and a behavior class on the same bbox**:
   - Keep both annotations — YOLO handles multi-label per image fine
   - The `person` class helps the model understand body context

3. **If confidence in a dataset's quality is low**:
   - Use it only for validation, not training
   - Or extract only the high-confidence subset

---

## 5. Training Pipeline

### Phase 1: Base Model Selection

**Start with: `yolov8s.pt` (YOLOv8-Small)**

| Model | Params | Speed (ms) | mAP | Why / Why Not |
|-------|--------|-----------|-----|---------------|
| yolov8n | 3.2M | 1.2ms | 37.3 | Too small — misses small phones, low accuracy |
| **yolov8s** | **11.2M** | **2.1ms** | **44.9** | **Best balance — accurate enough, still real-time on laptop GPU** |
| yolov8m | 25.9M | 5.0ms | 50.2 | Better accuracy but 2.5x slower — might drop below 15 FPS |
| yolov8l | 43.7M | 8.5ms | 52.9 | Too heavy for real-time webcam |

yolov8s gives us ~2x the accuracy of yolov8n (our current model) while staying under 3ms per frame. On a laptop without dedicated GPU, we'll still get 10–15 FPS with CPU inference.

### Phase 2: Training Steps

```
STEP 1 — Base Training (full merged dataset)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Model:      yolov8s.pt (pretrained on COCO)
  Dataset:    merged_dataset/ (all core datasets combined)
  Epochs:     100
  Batch:      16 (reduce to 8 if GPU OOM)
  Image size: 640
  Patience:   20 (early stopping — stops if val mAP doesn't improve for 20 epochs)
  Optimizer:  AdamW (default)

  Command:
  yolo detect train \
    model=yolov8s.pt \
    data=merged_dataset/data.yaml \
    epochs=100 \
    batch=16 \
    imgsz=640 \
    patience=20 \
    project=trackify_training \
    name=base_v1

  Expected: ~2-4 hours on RTX 3060, ~8-12 hours on CPU
  Target mAP@50: > 0.65


STEP 2 — Evaluate Base Model
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  yolo detect val \
    model=trackify_training/base_v1/weights/best.pt \
    data=merged_dataset/data.yaml

  Check per-class metrics:
  - phone_use AP > 0.50  (was ~0.15 with COCO yolov8n)
  - sleeping AP > 0.60
  - fighting AP > 0.55
  - talking AP > 0.40   (hardest class — subtle behavior)
  - cheating AP > 0.40

  If any class AP < 0.30 → that class needs more data or cleaning.


STEP 3 — Fine-tune on Classroom-Specific Data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Take the best.pt from Step 1.
  Fine-tune on ONLY D3 + D4 (pure classroom data) with lower LR.

  yolo detect train \
    model=trackify_training/base_v1/weights/best.pt \
    data=classroom_only/data.yaml \
    epochs=30 \
    batch=16 \
    imgsz=640 \
    lr0=0.001 \
    lrf=0.01 \
    patience=10 \
    project=trackify_training \
    name=finetune_v1

  This shifts the model's attention toward classroom environments
  without losing the general knowledge from Step 1.


STEP 4 — Final Validation
━━━━━━━━━━━━━━━━━━━━━━━━━
  Test on D5 (Student Action Recognition) as hold-out set.
  This dataset was NOT used in training → true generalization test.

  yolo detect val \
    model=trackify_training/finetune_v1/weights/best.pt \
    data=holdout_test/data.yaml

  If mAP@50 > 0.55 on unseen data → model generalizes well.
  If mAP@50 < 0.40 → overfitting, reduce fine-tune epochs or add augmentation.


STEP 5 — Export & Deploy
━━━━━━━━━━━━━━━━━━━━━━━━
  Copy best.pt to project:
  cp trackify_training/finetune_v1/weights/best.pt \
     trackify-eye-main/trackify_behavior.pt
```

### `data.yaml` for Merged Dataset

```yaml
# merged_dataset/data.yaml
path: ./merged_dataset
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
```

### Train/Val/Test Split

```
Total images → 70% train / 20% val / 10% test
Per dataset — split BEFORE merging to avoid data leakage
(same scene in train AND val = cheating on metrics)
```

---

## 6. Integration with Trackify Pipeline

### Current Pipeline

```
Camera → Frame → YOLO (yolov8n.pt) ─────→ person boxes, phone, bottle, cup
                 │
                 ├─→ SCB (scb_bowturnhead.pt) → BowHead, TurnHead
                 │
                 ├─→ MediaPipe Face Mesh ────→ landmarks → talking, eye closure,
                 │                                          head droop, head turn
                 │
                 └─→ InsightFace ────────────→ face recognition → attendance
                 │
                 └─→ detect_behaviors() ─────→ merge all signals → behavior list
```

### New Pipeline (after training)

```
Camera → Frame → CUSTOM MODEL (trackify_behavior.pt) → person, phone_use,
                 │                                       sleeping, talking,
                 │                                       cheating, fighting
                 │
                 ├─→ InsightFace ────────────→ face recognition → attendance
                 │
                 └─→ YOLO (yolov8n.pt) ─────→ bottle, cup (eating/drinking only)
                                               [SECONDARY — optional]
```

### What Changes in `trackify_backend.py`

```python
# BEFORE (current):
self.behavior_model = YOLO("yolov8n.pt")         # Generic COCO
self.scb_model = YOLO("scb_bowturnhead.pt")       # BowHead/TurnHead only

# AFTER (new):
self.behavior_model = YOLO("trackify_behavior.pt")  # Custom 8-class model
self.scb_model = None                                # No longer needed
# Keep yolov8n.pt ONLY for bottle/cup fallback (eating/drinking)
self.object_model = YOLO("yolov8n.pt")
```

### What Gets Simplified

| Current Method | Status After Training |
|----------------|----------------------|
| `detect_cheating()` (MediaPipe head turn heuristic) | **REMOVED** — model detects `cheating` directly |
| `detect_head_drooping()` (MediaPipe landmark math) | **REMOVED** — model detects `sleeping` directly |
| `detect_talking()` (MAR threshold heuristic) | **REMOVED** — model detects `talking` directly |
| `detect_fighting()` (bbox overlap heuristic) | **REMOVED** — model detects `fighting` directly |
| `detect_eyes_closed()` (EAR threshold) | **KEEP** — useful as secondary drowsy signal |
| SCB model BowHead/TurnHead | **REMOVED** — merged into custom model |
| COCO phone detection | **REMOVED** — `phone_use` in custom model |
| COCO bottle/cup detection | **KEEP** — eating/drinking fallback |

### New `detect_behaviors()` — Simplified

```python
def detect_behaviors(self, face_data, behavior_detections, object_detections=None):
    """
    behavior_detections: list from custom model (phone_use, sleeping, etc.)
    object_detections: list from yolov8n (bottle, cup) — optional
    """
    behaviors = []
    x1, y1, x2, y2 = face_data['rect']

    # Check custom model detections overlapping this face
    for det in behavior_detections:
        label = det['label']
        if label == 'person':
            continue  # Skip person class

        # Check if detection overlaps with this student's face area
        bx1, by1, bx2, by2 = det['bbox']
        if bx2 < x1 or bx1 > x2 or by2 < y1 or by1 > y2:
            continue  # No overlap

        behavior_map = {
            'phone_use': 'Phone',
            'sleeping': 'Sleeping',
            'talking': 'Talking',
            'cheating': 'Cheating',
            'fighting': 'Fighting',
        }
        if label in behavior_map:
            behaviors.append(behavior_map[label])

    # Fallback: eating/drinking from COCO model
    if object_detections:
        for obj in object_detections:
            if 'bottle' in obj['label'] or 'cup' in obj['label']:
                bx1, by1, bx2, by2 = obj['bbox']
                if not (bx2 < x1 or bx1 > x2 or by2 < y1 or by1 > y2):
                    if 'bottle' in obj['label']:
                        behaviors.append('Drinking')
                    else:
                        behaviors.append('Eating')

    return behaviors
```

### Performance Expectations

| Metric | Current (yolov8n + heuristics) | After (yolov8s custom) |
|--------|-------------------------------|------------------------|
| Phone detection | ~15–25% recall | ~60–75% recall |
| Sleeping detection | ~50% (depends on head angle) | ~70–85% |
| Talking detection | ~30% (MAR is noisy) | ~50–65% |
| Cheating detection | ~40% (head turn heuristic) | ~55–70% |
| Fighting detection | ~20% (bbox overlap is crude) | ~65–80% |
| Inference speed | ~3ms (yolov8n) + ~3ms (SCB) = 6ms | ~3ms (yolov8s) single pass |
| False positives | HIGH (heuristic noise) | MEDIUM (learned patterns) |

---

## 7. Per-Behavior Improvement Plan

### Phone Detection (Priority #1)

**Current problem**: COCO "cell phone" is trained on phones-on-tables, not phones-in-hand. Tiny object, low contrast in classroom lighting.

| Dataset | Contribution |
|---------|-------------|
| **D1** (Student with Phone) | Primary — dedicated phone-in-hand images |
| **D3** (Burak) | "looking_at_phone" class — student posture + phone |
| **D4** (Classroom Attitude) | Phone use in classroom context |

**Still need custom data?** Maybe. If merged phone data < 500 images:
- Record 5 minutes of students holding phones at various angles
- Annotate with Roboflow (fast, ~2 hours for 200 images)
- Augment: brightness variations (classroom lighting changes a lot)

### Sleeping Detection (Priority #2)

**Current problem**: Depends on MediaPipe head angle + SCB BowHead. Misses students sleeping with head turned sideways or resting on arms.

| Dataset | Contribution |
|---------|-------------|
| **D3** (Burak) | Sleeping class in classroom |
| **D4** (Classroom Attitude) | Sleeping in classroom |
| **D2** (Employee Performance) | Desk-sleeping from office (different angles) |

**Custom data needed?** No — three datasets should give 500+ sleeping annotations. That's enough.

### Talking Detection (Priority #3)

**Current problem**: MAR (Mouth Aspect Ratio) triggers on yawning, chewing, and coughing. High false positive rate.

| Dataset | Contribution |
|---------|-------------|
| **D4** (Classroom Attitude) | Only dataset with explicit "talking" class |

**Custom data needed?** YES, probably. Talking is the hardest behavior to detect with bounding boxes alone because:
- The visual difference between "talking" and "not talking" is subtle
- Open mouth ≠ talking (could be yawning)
- Best approach: keep MediaPipe MAR as a secondary signal alongside the model

**Recommendation**: Train with D4's talking class, but also keep the MediaPipe `detect_talking()` as a confirming signal. Only report "Talking" when BOTH the model AND MediaPipe agree.

### Fighting Detection (Priority #4)

**Current problem**: Crude bbox-overlap heuristic. Triggers on students sitting close together. Misses fights where students aren't overlapping.

| Dataset | Contribution |
|---------|-------------|
| **D8** (Ningbo University) | Multi-class fight dataset from research |
| **D7** (Ezgi) | Supplementary fight images |

**Custom data needed?** No — D7 + D8 combined should give 500+ fighting annotations. But classroom fights are rare and visually different from street fights. If most fight data is outdoor/surveillance → collect 50–100 classroom-specific fight images (staged by students).

---

## 8. Risks and Limitations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Domain gap** — Fight datasets are mostly outdoor/surveillance, not classroom | Fighting model may miss classroom scuffles | Add 50–100 staged classroom fight images |
| **Class imbalance** — "person" will have 5x more annotations than "talking" | Model biases toward person, ignores rare classes | Use `class_weights` or oversample rare classes during training |
| **Talking is visually ambiguous** | Low AP on talking class (<0.40) | Keep MediaPipe MAR as confirming signal |
| **No eating/drinking data** | Can't train these classes | Keep yolov8n COCO fallback for bottle/cup |
| **Lighting variation** — classroom lighting differs from dataset lighting | Model trained on well-lit images fails in dim rooms | Augmentation: brightness ±40%, contrast ±20% |
| **Camera angle** — our webcam is front-facing, datasets may have overhead/side angles | Pose mismatch | Filter datasets to keep only similar camera angles |
| **Overfitting on small datasets** | Memorizes training images, fails on new students | Early stopping (patience=20), augmentation, holdout validation |
| **yolov8s is 2x slower than yolov8n** | May reduce FPS on weak laptops | If FPS drops below 10, fall back to yolov8n with custom weights |

---

## 9. Final Summary

### Dataset Combination Plan

```
CORE (train on all):
  D1 — Student with Phone     → phone_use, person
  D3 — Student Behavior       → phone_use, sleeping, cheating
  D4 — Classroom Attitude     → phone_use, sleeping, talking, cheating
  D8 — Fight (Ningbo)         → fighting, person

SUPPORTING (selective use):
  D2 — Employee Performance   → sleeping ONLY (extract, discard rest)
  D7 — Fight Detection        → fighting (augment D8)

HOLD-OUT (validation only):
  D5 — Student Action         → test generalization

REVIEW FIRST:
  D6 — TeacerEye              → unknown quality, inspect before using

SKIP:
  GitHub sensor dataset        → not vision data (user already flagged this)
```

### Final Class List

```
0: person       — anchor class, helps model understand body context
1: phone_use    — student holding/looking at phone
2: sleeping     — head down on desk, eyes closed
3: talking      — student talking to neighbor
4: cheating     — looking sideways, copying, not paying attention
5: fighting     — physical altercation between students
6: eating       — (COCO fallback, not in custom model)
7: drinking     — (COCO fallback, not in custom model)
```

### Training Pipeline (Step-by-Step)

```
1. Download 6 datasets from Roboflow (D1–D5, D7, D8) in YOLOv8 format
2. Run remap_labels.py on each dataset
3. Merge into merged_dataset/ with 70/20/10 split
4. Run check_distribution.py — verify no class < 300 annotations
5. Run clean_labels.py — remove degenerate boxes
6. Base train: yolov8s.pt → 100 epochs on merged_dataset
7. Evaluate: check per-class AP, identify weak spots
8. Fine-tune: best.pt → 30 epochs on D3+D4 only (classroom focus)
9. Holdout test: validate on D5
10. Deploy: copy best.pt → trackify_behavior.pt
11. Update trackify_backend.py to use new model
12. Remove SCB model + MediaPipe heuristics (except eye closure + talking confirm)
```

### What's Missing (Gaps to Fill Later)

1. **Eating/Drinking training data** — not in any dataset, using COCO fallback
2. **Drowsy as separate class** — currently merged into sleeping. Could split later with eye-closure data
3. **Classroom-specific fight data** — most fight datasets are outdoor. Staged recordings would help
4. **Talking confirmation** — model alone won't be reliable. Keep MAR heuristic as second opinion
5. **Night/dim lighting data** — if classrooms have variable lighting, add augmentation or collect dark samples
