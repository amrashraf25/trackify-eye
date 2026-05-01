# Note-Taking Analytics — Tests

Unit tests (Jira: TP-28).

## Folder
```
tests/note_taking_analytics/
├── feature_files/
│   └── NoteTakingAnalytics.tsx
├── test_note_taking_analytics.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/note_taking_analytics/test_note_taking_analytics.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| formatDuration | AC3 | Correct "Xm Ys" format, "0m 00s" for zero, 60s boundary |
| calcEngagementScore | AC1 | Correct ratio, 0-session = 0 (no crash), >100% capped at 100 |
| filterBySession | AC2 | Session match, single result, non-existent session |
| buildStudentSummary | AC2 | Multi-session aggregation, 0-second student, single student |
| sortByDuration | AC3 | Descending/ascending order, single-element passthrough |
| getTopEngaged | AC3 | Top-N by score, n=0 returns empty, n > total returns all |

## Upload as a branch
```bash
git checkout -b feature/note_taking_analytics-tests
git add tests/note_taking_analytics/
git commit -m "test: unit tests for note-taking analytics"
git push origin feature/note_taking_analytics-tests
```
