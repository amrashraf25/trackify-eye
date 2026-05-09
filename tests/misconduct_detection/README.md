# Misconduct Detection — Tests

Unit tests (Jira: TP-21, TP-22).

## Folder
```
tests/misconduct_detection/
├── feature_files/
│   └── MisconductDetection.tsx
├── test_misconduct_detection.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/misconduct_detection/test_misconduct_detection.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| AC1: formatIncidentDisplay — timestamp and location in display | AC1 | Incident timestamp, location, camera source, severity color mapping |
| AC2: meetsConfidenceThreshold and filterByConfidence | AC2 | Confidence gate at 0.75, boundary exact match, confidence 0 always fails |
| AC3: groupByBehaviorType, sortByTimestamp, filterByBehaviorType | AC3 | Type counts, sort order, filter by type/all, unknown type = empty |

## Upload as a branch
```bash
git checkout -b feature/misconduct-detection-tests
git add tests/misconduct_detection/
git commit -m "test: unit tests for misconduct detection (TP-21, TP-22)"
git push origin feature/misconduct-detection-tests
```
