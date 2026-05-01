# Fight Alert Auto-Clear — Tests

Unit tests (Jira: TP-25).

## Folder
```
tests/fight_alert_autoclear/
├── feature_files/
│   └── FightAlertAutoClear.tsx
├── test_fight_alert_autoclear.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/fight_alert_autoclear/test_fight_alert_autoclear.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| getAlertAge | AC1 | Correct elapsed seconds, zero-duration, negative-duration clamp |
| isEligibleForAutoClear | AC1 | Exactly 300s = eligible, 299s = not eligible |
| shouldAutoClear | AC2 | clear camera triggers, unknown/active camera do not |
| getAlertStatus | AC2 | cleared/resolved passthrough, fresh alert = active |
| buildClearNotification | AC3 | All fields populated, non-empty message, location included |
| filterByStatus | AC3 | Status match, empty list, unknown status |

## Upload as a branch
```bash
git checkout -b feature/fight_alert_autoclear-tests
git add tests/fight_alert_autoclear/
git commit -m "test: unit tests for fight alert auto-clear"
git push origin feature/fight_alert_autoclear-tests
```
