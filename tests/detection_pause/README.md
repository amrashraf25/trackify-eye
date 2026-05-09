# Detection Pause — Tests

Unit tests (Jira: TP-17).

## Folder
```
tests/detection_pause/
├── feature_files/
│   └── DetectionPause.tsx
├── test_detection_pause.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/detection_pause/test_detection_pause.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| AC1: isPauseActive and getPauseStatus | AC1 | Pause button visibility, active/resuming/idle status transitions, null pausedAt = idle, boundary expiry |
| AC2: validateDuration and getRemainingSeconds | AC2 | Duration validation (1–60 min), remaining seconds calculation, no-negative clamping |
| AC3: formatCountdown and countdown-to-zero behaviour | AC3 | MM:SS formatting, zero-padding, negative clamping, countdown reaches 0 at expiry |

## Upload as a branch
```bash
git checkout -b feature/detection-pause-tests
git add tests/detection_pause/
git commit -m "test: unit tests for detection pause (TP-17)"
git push origin feature/detection-pause-tests
```
