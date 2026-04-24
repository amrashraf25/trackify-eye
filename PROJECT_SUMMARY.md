# TRACKIFY — Full Project Summary
> Complete context for continuing development in a new chat session

---

## 1. What Is Trackify?

**Trackify Eye** is an AI-powered smart classroom monitoring system. It uses a webcam to automatically:
- **Recognize students' faces** and mark attendance
- **Detect bad behaviors** (sleeping, cheating, using phone, fighting, etc.)
- **Track scores** per student per course per week
- **Alert** doctors/deans in real time

---

## 2. Three-Service Architecture

All three must run simultaneously:

| Service | Port | Tech | Start Command |
|---------|------|------|---------------|
| Frontend | 8080 | React + Vite | `npm run dev` (root) |
| Local API | 3001 | Express.js + SQLite | `cd local-api && node server.js` |
| Python AI Backend | 5000 | Flask + OpenCV + InsightFace | `python trackify_backend.py` |

**One-command start (all three):**
```
npm run dev:all
```
Logs go to: `logs_backend.txt`, `logs_frontend.txt`, `logs_ai.txt`

---

## 3. Directory Structure

```
trackify-eye-main/
├── src/                        ← React frontend
│   ├── pages/                  ← All page components
│   ├── components/             ← Shared UI components
│   ├── hooks/                  ← useAuth, etc.
│   ├── integrations/supabase/  ← Supabase client (points to localhost:3001)
│   └── index.css               ← Theme CSS variables (light + dark)
├── local-api/                  ← Node.js Express API
│   ├── server.js               ← Main server (30 KB) — auth, users, storage
│   ├── routes/                 ← Route handlers
│   ├── services/               ← Business logic
│   ├── models/                 ← DB layer (SQLite or JSON fallback)
│   └── trackify.db             ← SQLite database
├── trackify_backend.py         ← Python AI backend (Flask server)
├── .env                        ← VITE_SUPABASE_URL=http://localhost:3001
├── HOW_TO_RUN.txt              ← Full setup instructions
└── package.json                ← npm scripts including dev:all
```

---

## 4. Frontend Pages (`src/pages/`)

| Page | Route | Who Sees It | Purpose |
|------|-------|-------------|---------|
| `Auth.tsx` | `/` | Everyone | Login with demo accounts |
| `Dashboard.tsx` | `/dashboard` | All roles | Stats overview |
| `Courses.tsx` | `/courses` | All roles | Course list + behavior/attendance per course |
| `Schedules.tsx` | `/schedules` | Dean/Admin | Create/edit class schedules with AM/PM time picker |
| `Sessions.tsx` | `/sessions` | Dean/Doctor | View active + past camera sessions |
| `Camera.tsx` | `/camera` | Dean/Doctor | Start/stop AI monitoring, live feed |
| `Attendance.tsx` | `/attendance` | All roles | View attendance records |
| `Students.tsx` | `/students` | Dean/Doctor | Student profiles, behavior scores per course |
| `Doctors.tsx` | `/doctors` | Dean/Admin | Doctor profiles |
| `Behavior.tsx` | `/behavior` | Dean/Doctor | Behavior tracking board |
| `Alerts.tsx` | `/alerts` | All roles | Real-time incident alerts |
| `Reports.tsx` | `/reports` | Dean/Admin | Export reports |
| `Settings.tsx` | `/settings` | Admin | System settings |

---

## 5. Roles

| Role | Permissions |
|------|-------------|
| `dean` | Full access — manage schedules, students, courses, view all data |
| `doctor` | See only their courses/students, start/end sessions, view behavior |
| `admin` | Same as dean + system settings |
| `student` | See only their own courses, attendance, behavior score |

**Demo accounts** (password shown on login screen):
- Dean: `dean@trackify.com` / `dean123`
- Doctor: `doctor@trackify.com` / `doctor123`
- Student: `student@trackify.com` / `student123`

---

## 6. Database Tables (SQLite — `local-api/trackify.db`)

| Table | Purpose |
|-------|---------|
| `profiles` | Auth users (dean/doctor/admin) with role, email, hashed password |
| `students` | Student academic records (name, code, year, user_id link) |
| `courses` | Course definitions (name, code, doctor_id, credits) |
| `enrollments` | Student ↔ Course many-to-many |
| `schedules` | Weekly class schedule (day_of_week, start_time, end_time, room, session_type, week_number) |
| `sessions` | Camera monitoring sessions (course_id, doctor_id, started_at, ended_at, status, trigger) |
| `attendance_records` | Per-student per-session attendance (present/absent/late) |
| `behavior_logs` | **PRIMARY behavior table** — AI-detected incidents (student_id, course_id, behavior_type, severity, session_id, week_number, started_at) |
| `behavior_scores` | Cached overall behavior score per student (score 0–100) |
| `behavior_records` | Legacy manual behavior records (rarely used now) |
| `notifications` | In-app notifications sent to users |

---

## 7. Key API Endpoints (`local-api/server.js` + routes)

### Auth
- `POST /auth/v1/token?grant_type=password` — Login (returns JWT)
- `GET /auth/v1/user` — Current user from JWT

### Supabase-Compatible REST
- `GET/POST /rest/v1/:table` — Generic CRUD (used by Supabase client)
- Supports filtering: `?student_id=eq.XXX`, ordering, select

### Local API Routes
- `GET/POST/PATCH/DELETE /api/schedule` — Schedule CRUD
- `POST /api/schedule/:id/start` — Manual start session
- `POST /api/schedule/:id/end` — Manual end session
- `GET /api/schedule/today` — Today's schedule
- `GET /api/session` — List sessions
- `GET/POST /api/ai/attendance` — AI posts face recognition results
- `GET/POST /api/ai/behavior` — AI posts behavior detection results
- `GET /api/analytics/*` — Dashboard stats
- `GET /api/student/me?user_id=X` — Resolve student record from auth user

---

## 8. Python AI Backend (`trackify_backend.py`)

**Runs on:** `http://localhost:5000`

### Flask Endpoints
- `POST /start` — Start AI monitoring for a session (course_id, session_id, room)
- `POST /stop` — Stop AI monitoring, clear cooldown caches
- `GET /status` — Returns `{active, session_id, fps, ...}`
- `GET /video_feed` — MJPEG stream of annotated camera frames

### AI Pipeline (runs in background thread)
1. **Camera capture** — OpenCV, tries MSMF first, then default, then DSHOW last (Windows Error 6 fix)
2. **Face detection** — InsightFace `buffalo_sc` model
3. **Face recognition** — Compares detected face embedding to registered students
4. **Attendance** — If similarity >= 0.30, fires POST to `/api/ai/attendance` (30s cooldown per student)
5. **Behavior detection** — Custom trained `trackify_behavior.pt` detects: phone_use, sleeping, cheating, fighting directly. Talking uses MediaPipe MAR. Eating/drinking uses COCO yolov8n.pt fallback (bottle/cup).
6. **Behavior reporting** — If confidence >= threshold, fires POST to `/api/ai/behavior` (30s cooldown per student+behavior)

### Models Used
| Model | File | Purpose |
|-------|------|---------|
| `trackify_behavior.pt` (5.9 MB) | Custom YOLOv8n trained on 5900 classroom images | Primary behavior detection: phone_use (27%), sleeping (99%), cheating (61%), fighting (75%) |
| `yolov8n.pt` (6.5 MB) | COCO pretrained | Eating/drinking fallback (bottle, cup, food objects) |
| InsightFace buffalo_l | Face recognition | Student identity + attendance |
| MediaPipe Face Mesh | Landmark heuristics | Talking (MAR), Drowsy (eye closure) |

### Camera Fix (Windows)
- Uses threading timeout (5s) to prevent MSMF hang
- Always reads frames even when session inactive (prevents MSMF idle disconnect)
- Backend priority: MSMF → default → DSHOW

### Behavior Types Detected
`cheating`, `talking`, `sleeping`, `drowsy`, `fighting`, `phone`, `drinking`, `eating`

### Severity → Score Change Mapping
```python
BEHAVIOR_TYPE_MAP = {
    "Cheating": "cheating", "Talking": "talking", "Sleeping": "sleeping",
    "Drowsy": "drowsy", "Fighting": "fighting", "Phone": "phone",
    "Drinking": "drinking", "Eating": "eating",
}
# Score change applied: critical=-20, high=-10, medium=-5, low=-2
```

---

## 9. Auto-Scheduler (`local-api/services/schedule-service.js`)

Runs every **5 seconds** (was 60s, fixed). Logic:
- **Auto-start**: Find schedules where `day_of_week == today` AND `start_time <= now < end_time` AND no session started today → call `startSession()`
- **Auto-end path A**: Sessions where `scheduled_end_at <= now` → call `endSession()`
- **Auto-end path B**: Active sessions linked to schedule where `end_time <= now` → call `endSession()`
- `setImmediate(tick)` is called after any schedule create/update for instant effect

---

## 10. Behavior Score System

### How Scores Work
- Base score = **100** per course
- Each AI-detected incident subtracts points based on severity
- **Overall student score** = average of per-course scores across all enrolled courses
- Displayed: score ring on student cards, behavior % in profile panel, per-course breakdown

### Single Source of Truth: `behavior_logs`
All pages now read from **`behavior_logs`** table (written by AI backend):
- `Behavior.tsx` (Behavior Tracking page) ✓
- `Courses.tsx` (behavior tab) ✓ — fixed in this session
- `Students.tsx` (student profile sidebar) ✓ — fixed in this session

`behavior_records` table = legacy manual entries, no longer the primary source.

### Severity → Score Change
```typescript
const severityToChange = (sev: string) =>
  sev === "critical" ? -20 : sev === "high" ? -10 : sev === "medium" ? -5 : -2;
```

### `behavior_logs` Field Normalization (used in all pages)
```typescript
return data.map((r: any) => ({
  ...r,
  action_type: "negative",       // AI only detects bad behavior
  action_name: r.behavior_type,  // "cheating", "sleeping", etc.
  score_change: severityToChange(r.severity),
  created_at: r.started_at,
}));
```

---

## 11. Attendance System

### How It Works
1. AI recognizes face with similarity >= 0.30
2. POSTs to `POST /api/ai/attendance` with `{student_id, session_id, similarity, ...}`
3. `validateSessionWindow()` checks session is active OR ended within 5 minutes (grace period)
4. Record inserted into `attendance_records` with status `present`

### Student Identity Linking
The `students` table has a `user_id` column (added via migration). When a student logs in:
- `GET /api/student/me?user_id=X` is called
- Tries direct `user_id` match first
- Falls back to email match via `profiles`
- Falls back to full_name match
- Auto-patches `user_id` into student row on first match

---

## 12. Session Lifecycle

```
Schedule created → tick() runs → auto-start → session status='active'
                                             ↓
                              AI backend /start called (Camera page)
                                             ↓
                         Face recognition → attendance_records
                         Behavior detection → behavior_logs
                                             ↓
                              schedule end_time reached → auto-end
                              OR manual /end called
                                             ↓
                                    session status='ended'
```

---

## 13. Frontend Data Fetching Patterns

All queries use **React Query** (`@tanstack/react-query`):

| Setting | Value | Why |
|---------|-------|-----|
| `staleTime` | `0` | Always refetch — no stale data |
| `refetchInterval` | `3000–5000ms` | Live updates |
| `refetchOnWindowFocus` | `true` | Refresh when switching tabs |

After mutations, use `queryClient.refetchQueries()` (not `invalidateQueries`) for immediate UI updates.

---

## 14. Schedule Time Picker (AM/PM)

`Schedules.tsx` has a custom `TimePicker` component:
```typescript
function parse12h(time24: string): { hour, minute, period: "AM"|"PM" }
function to24h(hour, minute, period): string  // converts back to HH:MM for storage
```
All times stored as `HH:MM` 24-hour format in DB, displayed as 12-hour with AM/PM.

---

## 15. Light Mode / Theme

Theme is controlled by CSS variables in `src/index.css`:
- `.light` — white card (`--card: 0 0% 100%`), light background
- `.dark` — dark card (`--card: 225 25% 10%`), dark background

**All pages should use theme-aware classes** — `bg-card`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`. Avoid hardcoded `hsl(225 25% 8%)` or `text-white`.

`Students.tsx` was fully refactored to use CSS variables. Other pages may still have hardcoded dark colors.

---

## 16. Soft Delete Pattern

Schedules use soft delete:
```javascript
// DELETE → sets is_active = 0, does NOT remove row
function deleteSchedule(id) {
  run('UPDATE schedules SET is_active = 0 WHERE id = ?', [id]);
}
```
Always fetch schedules with `?active_only=1` to exclude deleted ones.

---

## 17. Known Issues / Watch Out For

| Issue | Fix Applied |
|-------|-------------|
| MSMF camera hang on Windows | `_try_open()` thread with 5s timeout |
| Windows Error 6 (DSHOW) | DSHOW moved to last priority |
| MSMF idle disconnect | Always read frames even when inactive |
| Sessions take 60s to appear | Scheduler changed to 5s + `setImmediate(tick)` |
| Attendance stays absent | Threshold lowered 0.45→0.30, 5-min grace period added |
| Student can't see courses | `/api/student/me` endpoint added for user_id linking |
| Behavior scores disconnected | All pages now use `behavior_logs` table |
| Deleted schedules remain visible | Fetch with `?active_only=1` |
| Double className in JSX | Be careful when replacing `style={{...}}` with `className=` |

---

## 18. Environment & Config

**`.env` (root):**
```
VITE_SUPABASE_URL=http://localhost:3001
VITE_SUPABASE_PUBLISHABLE_KEY=local-anon-key
VITE_SUPABASE_PROJECT_ID=local
```

**The Supabase client is pointed at `localhost:3001`** — the local Express API, NOT real Supabase cloud. All `supabase.from('table')` calls go to the local API via the Supabase JS SDK compatibility layer in `server.js`.

---

## 19. How to Start the Project

```bash
# Terminal 1 — all three services at once:
cd C:\Users\FARES\Downloads\trackify-eye-main
npm run dev:all

# OR individually:
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — Local API
cd local-api
node server.js

# Terminal 3 — Python AI
python trackify_backend.py
```

Then open: `http://localhost:8080`

---

## 20. Files Changed in This Session

| File | What Changed |
|------|-------------|
| `trackify_backend.py` | Camera fix (MSMF/DSHOW), behavior recording, attendance threshold 0.30, cooldown caches |
| `src/pages/Schedules.tsx` | AM/PM TimePicker, `?active_only=1` fetch, `refetchQueries` |
| `src/pages/Sessions.tsx` | `refetchInterval: 3000`, `staleTime: 0` |
| `src/pages/Camera.tsx` | `refetchInterval: 4000`, `staleTime: 0` |
| `src/pages/Courses.tsx` | `behavior_logs` for all behavior queries, normalization, `myStudentRecord` from local API |
| `src/pages/Students.tsx` | `behavior_logs` source, per-course average score, light mode CSS variables |
| `local-api/routes/ai-events.js` | 5-min grace period in `validateSessionWindow` |
| `local-api/routes/schedules.js` | `setImmediate(tick)` on create/update |
| `local-api/services/schedule-service.js` | Scheduler interval 60s→5s |
| `local-api/server.js` | `GET /api/student/me` endpoint, `ALTER TABLE students ADD COLUMN user_id` migration |

---

## 21. AI Model Training Strategy (Planned Upgrade)

### Current Detection Stack (What We Have)

| Component | Model File | Detects | Problem |
|-----------|-----------|---------|---------|
| `yolov8n.pt` | YOLOv8-nano (COCO pretrained, 6.5 MB) | person, cell phone, bottle, cup | COCO "cell phone" has ~15-25% recall — terrible for classroom phone detection |
| `scb_bowturnhead.pt` | Custom YOLOv8 (6.2 MB) | BowHead (sleeping), TurnHead (cheating) | Only 2 classes, small dataset, limited variety |
| MediaPipe Face Mesh | Landmark heuristics (no .pt file) | talking (MAR), eye closure, head droop, cheating (head turn) | Rule-based — high false positives, no learning |
| Heuristic code | `detect_fighting()` in trackify_backend.py | Fighting (bbox overlap for 8+ frames) | Very crude — misses real fights, triggers on students sitting close |

The system stitches 3 separate detection paths together with `if/else` logic. Each has blind spots.

### Target: One Unified Custom Model

Replace most of the above with a single **YOLOv8s** model (`trackify_behavior.pt`) trained on merged classroom datasets.

### Datasets Gathered (8 total)

**Core Datasets (main training):**

| ID | Dataset | Source | Key Classes | Role |
|----|---------|--------|-------------|------|
| D1 | Student with Phone | `roboflow.com/class-bj4a9/student-with-phone` | phone_use, person | Primary phone detection data — our #1 accuracy gap |
| D3 | Student Behavior Detection (Burak) | `roboflow.com/burak-koyfx/student-behavior-detection` | not_listening, listening, looking_at_phone, sleeping (~2.2K images) | Largest classroom-specific multi-behavior set |
| D4 | Classroom Attitude | `roboflow.com/nguyenducmanhs-workspace/classroom-attitude` | sleeping, talking, phone, cheating, attention | Only dataset with explicit "talking" class |
| D8 | Fight (Ningbo University) | `roboflow.com/ningbo-university/fight-aa8bp` | fight, person, fall, stand, jump | Multi-class fight data from university research |

**Supporting Datasets (selective use):**

| ID | Dataset | Use Only |
|----|---------|----------|
| D2 | Employee Performance Monitoring | Extract `Sleeping` class only (different angles), discard office-context classes |
| D7 | Fight Detection (Ezgi) | Supplementary fighting images to augment D8 |

**Hold-out (validation only):** D5 — Student Action Recognition (Namit Adhikari)
**Review first:** D6 — TeacerEye (unknown quality — inspect 50 images before deciding)
**Skipped:** GitHub sensor dataset (not vision data)

### Unified Class List (8 classes)

```yaml
names:
  0: person       # anchor class — body context
  1: phone_use    # student holding/looking at phone
  2: sleeping     # head down on desk, eyes closed
  3: talking      # student talking to neighbor
  4: cheating     # looking sideways, copying, not paying attention
  5: fighting     # physical altercation
  6: eating       # (COCO fallback — no training data in these datasets)
  7: drinking     # (COCO fallback — no training data in these datasets)
```

### Label Remapping (Cross-Dataset Unification)

All datasets use different class names for the same behaviors. Key mappings:
- `phone`, `using_phone`, `mobile`, `looking_at_phone` → `phone_use`
- `don't listening`, `not_listening` → `cheating`
- `listening`, `attention`, `reading`, `writing` → DISCARD (we don't detect good behavior)
- `fall`, `stand`, `jump`, `walking` → DISCARD (not in our behavior list)

Script: `scripts/remap_labels.py` handles all conversions per-dataset.

### Training Pipeline

```
Step 1 — Base Training
  Model:  yolov8s.pt (COCO pretrained) — 2x more accurate than yolov8n, still real-time
  Data:   All core datasets merged (D1+D3+D4+D8 + supporting D2-sleeping + D7-fighting)
  Config: 100 epochs, batch=16, imgsz=640, patience=20 (early stopping), AdamW
  Output: trackify_training/base_v1/weights/best.pt

Step 2 — Fine-tune on Classroom Data
  Model:  best.pt from Step 1
  Data:   Only D3 + D4 (pure classroom images)
  Config: 30 epochs, batch=16, lr0=0.001 (lower LR), patience=10
  Output: trackify_training/finetune_v1/weights/best.pt

Step 3 — Evaluate on Holdout
  Model:  best.pt from Step 2
  Data:   D5 (never seen during training)
  Target: mAP@50 > 0.55 = good generalization

Step 4 — Deploy
  Copy best.pt → trackify_behavior.pt in project root
```

### Data Cleaning Pipeline

Run before training:
1. `scripts/remap_labels.py` — Convert each dataset's class IDs to unified 8-class system
2. `scripts/deduplicate_images.py` — MD5 hash to remove exact duplicate images across datasets
3. `scripts/clean_labels.py` — Remove degenerate bboxes (<0.5% of image), out-of-range class IDs, malformed lines
4. `scripts/check_distribution.py` — Verify no class has <300 annotations (minimum for training)

### Integration After Training

**New pipeline (replaces current 3-path system):**
```
Camera → Frame → trackify_behavior.pt → person, phone_use, sleeping, talking, cheating, fighting
                 │
                 ├→ InsightFace → face recognition → attendance (unchanged)
                 │
                 └→ yolov8n.pt → bottle, cup only (eating/drinking COCO fallback)
```

**What gets removed from `trackify_backend.py`:**
- `scb_bowturnhead.pt` — no longer needed (sleeping/cheating in custom model)
- `detect_cheating()` — MediaPipe head-turn heuristic replaced by model
- `detect_head_drooping()` — replaced by model's sleeping class
- `detect_fighting()` — bbox-overlap heuristic replaced by model
- `detect_talking()` — **KEEP as confirming signal** (talking is hardest to detect visually)
- `detect_eyes_closed()` — **KEEP** as secondary drowsy signal

### Expected Accuracy Improvement

| Behavior | Current Recall | Expected After Training |
|----------|---------------|------------------------|
| Phone | ~15-25% | ~60-75% |
| Sleeping | ~50% | ~70-85% |
| Talking | ~30% | ~50-65% |
| Cheating | ~40% | ~55-70% |
| Fighting | ~20% | ~65-80% |
| Inference speed | ~6ms (yolov8n + SCB) | ~3ms (single yolov8s pass) |

### Gaps Still Open

1. **Eating/Drinking** — No training data in any dataset. Keep using COCO bottle/cup detection as fallback
2. **Talking confirmation** — Model alone won't be reliable enough. Keep MediaPipe MAR as second opinion
3. **Classroom-specific fight data** — Most fight datasets are outdoor/surveillance. May need 50-100 staged classroom fight images
4. **Dim lighting** — If classrooms have variable lighting, need brightness augmentation (±40%) during training

### Training Scripts (in `scripts/`)

| Script | Purpose |
|--------|---------|
| `remap_labels.py` | Convert dataset class IDs to unified system |
| `check_distribution.py` | Show annotation counts per class, flag imbalances |
| `clean_labels.py` | Remove bad bboxes, validate format |
| `deduplicate_images.py` | Find/remove exact duplicate images |
| `train_model.py` | Full pipeline: `python train_model.py all` (base → finetune → evaluate → deploy) |
| `data.yaml.template` | Copy to `merged_dataset/data.yaml` after merging |
