# Staff Punctuality Alerts — Tests

Unit tests for the staff punctuality alert system (Jira: TP-14).

## Folder
```
tests/staff_punctuality/
├── feature_files/
│   └── StaffPunctualityAlerts.tsx
├── test_staff_punctuality.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/staff_punctuality/test_staff_punctuality.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| AC1: Late arrival detection | AC1 (TP-14) | isLateArrival — 10-min boundary (exact = not late, +1 sec = late), early arrival, on-time arrival; getMinutesLate — positive/negative/zero diff |
| AC2: Early departure detection | AC2 (TP-14) | isEarlyDeparture — exact boundary, 1-second early, late departure; buildPunctualityAlert — correct object shape for both types, 0-minute diff; filterAlertsByStaff — valid ID, empty ID, nonexistent ID |

## Upload as a branch
```bash
git checkout -b feature/staff-punctuality-tests
git add tests/staff_punctuality/
git commit -m "test: unit tests for staff punctuality alerts feature"
git push origin feature/staff-punctuality-tests
```
