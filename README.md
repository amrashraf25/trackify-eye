# Trackify Eye

**AI-Powered Smart Classroom Monitoring System**

Trackify Eye uses computer vision and face recognition to automate student attendance tracking and behavior monitoring in real time.

---

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion, Recharts

**Backend:** Node.js + SQLite (Local API), Python + Flask (AI Pipeline)

**AI:** YOLOv8 (detection), InsightFace (face recognition), MediaPipe (pose/eye tracking)

**Database & Auth:** Supabase, SQLite

---

## Features

- Real-time face recognition via webcam
- Automatic attendance marking
- Behavior detection (sleeping, phone use, talking, cheating, fighting)
- Live dashboard with charts and analytics
- Instant behavior alerts and notifications
- Multi-role system: Admin, Dean, Doctor, Student
- Course management, assignments, and submissions
- Per-student behavior scores and trends

---

## Getting Started

### Requirements
- Node.js 18+
- Python 3.10+
- Webcam

### Run (Windows)

Double-click `run.bat` — starts all 3 services automatically:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Local API | http://localhost:3001 |
| Python AI | http://localhost:5000 |

### Install Python dependencies

```bash
pip install -r requirements.txt
```

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@trackify.com | admin123 |
| Dean | dean@trackify.com | dean123 |
| Doctor | doctor@trackify.com | doctor123 |
| Student | student@trackify.com | student123 |

---

## Project Structure

```
trackify-eye/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── pages/              # Page views
│   └── hooks/              # Custom hooks
├── local-api/              # Node.js REST API + SQLite
│   ├── routes/             # API endpoints
│   └── services/           # Business logic
├── trackify_backend.py     # Python AI pipeline
├── tracking.py             # Person tracker
├── counting.py             # Recognition + attendance
├── event_dispatcher.py     # Event queue
├── identity_binder.py      # Track to student mapping
└── run.bat                 # One-click launcher
```

---

## License

MIT
