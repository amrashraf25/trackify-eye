# Unknown Individuals — Tests

Unit tests (Jira: TP-26, TP-27).

## Folder
```
tests/unknown_individuals/
├── feature_files/
│   └── UnknownIndividuals.tsx
├── test_unknown_individuals.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/unknown_individuals/test_unknown_individuals.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| isUnknownFace | AC1-TP26/TP27 | Threshold boundary (exact match = NOT unknown), above threshold |
| classifyAlertPriority | AC1-TP26/TP27 | high/medium/low tiers, zero score |
| filterByCamera | AC2 | Camera match, all-same-camera, non-existent camera |
| formatDetectionAlert | AC2 | Contains camera name, starts with correct prefix |
| filterByDate | AC3 | Date match, empty date, future date, empty list |
| buildDailyReport (count/grouping) | AC3 | Correct total, byCamera map grouping |
| buildDailyReport (admin review) | AC4 | Timeline integrity, date field, multiple cameras |

## Upload as a branch
```bash
git checkout -b feature/unknown_individuals-tests
git add tests/unknown_individuals/
git commit -m "test: unit tests for unknown individuals detection"
git push origin feature/unknown_individuals-tests
```
