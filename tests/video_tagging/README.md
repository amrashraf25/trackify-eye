# Video Tagging — Tests

Unit tests (Jira: TP-23).

## Folder
```
tests/video_tagging/
├── feature_files/
│   └── VideoTagging.tsx
├── test_video_tagging.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/video_tagging/test_video_tagging.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| AC1: isValidLabel and validateClipForTag | AC1 | Valid label recognition, invalid/empty labels rejected, same-label re-tag blocked, different-label re-tag allowed |
| AC2: filterByTagged — tagged clip storage and retrieval | AC2 | Tagged/untagged split, empty list safety |
| AC3: filterByLabel, buildTagSummary, and sortClipsByDate | AC3 | "all" vs specific label filter, 0-match label = empty, summary totals + byLabel counts, sort asc/desc, no-mutation guarantee |

## Upload as a branch
```bash
git checkout -b feature/video-tagging-tests
git add tests/video_tagging/
git commit -m "test: unit tests for video tagging (TP-23)"
git push origin feature/video-tagging-tests
```
