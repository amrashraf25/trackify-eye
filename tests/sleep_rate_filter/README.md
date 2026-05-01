# Sleep Rate Filter — Tests

Unit tests (Jira: TP-24).

## Folder
```
tests/sleep_rate_filter/
├── feature_files/
│   └── SleepRateFilter.tsx
├── test_sleep_rate_filter.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/sleep_rate_filter/test_sleep_rate_filter.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| calculateSleepRate | AC1 | Correct %, zero-division guard, 100% case |
| isHighSleepClass | AC1 | Threshold boundary (exactly 20%), below-threshold rejection |
| filterHighSleepClasses | AC1 | Multi-session filter, empty input, threshold=0 edge |
| sortByRate | AC1 | Descending/ascending ordering by sleep rate |
| buildSleepSummary | AC1 | Worst class detection, empty-list zeroed summary |
| getTopSleepingStudents | AC2 | Top-N% slice, topPercent=0, empty list |

## Upload as a branch
```bash
git checkout -b feature/sleep_rate_filter-tests
git add tests/sleep_rate_filter/
git commit -m "test: unit tests for sleep rate filter"
git push origin feature/sleep_rate_filter-tests
```
