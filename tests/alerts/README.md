# Alerts Feature — Tests & Feature Files

Complete package for the Alerts feature: source files + unit tests.

---

## Folder structure

```
tests/
└── alerts/
    ├── feature_files/                        ← exact copies of the production source
    │   ├── Alerts.tsx                        ← main Alerts page
    │   ├── IncidentTable.tsx                 ← filterable incident log table
    │   ├── LiveIncidentFeed.tsx              ← real-time Supabase feed
    │   └── IncidentDetail.tsx                ← single incident detail view
    ├── test_alerts_backend.py                ← Python tests (Flask endpoints)
    ├── test_alerts_frontend.test.tsx         ← React/Vitest tests
    └── README.md                             ← this file
```

> **Note:** `feature_files/` are read-only reference copies.
> The live files the app uses are in `src/pages/` and `src/components/`.

---

## Running the backend tests

```bash
# Install (once)
pip install pytest flask

# Run
pytest tests/alerts/test_alerts_backend.py -v
```

### What is tested

| Class | Coverage |
|---|---|
| `TestAC1_IncidentRecording` | Alert counters accumulate correctly per behavior type |
| `TestAC2_AlertRetrieval` | GET /alerts returns 200, JSON, correct counts |
| `TestAC3_AlertReset` | POST /alerts/reset zeros all counters, safe on empty state |
| `TestAlertsSeverityFilter` | Pure-unit filter logic (mirrors IncidentTable.tsx filteredRecords) |

---

## Running the frontend tests

```bash
# Install (once)
npm install -D @testing-library/react @testing-library/jest-dom

# Run
npx vitest run tests/alerts/test_alerts_frontend.test.tsx
```

### What is tested

| describe block | Coverage |
|---|---|
| `IncidentTable: filter logic` | search + severity filter combinations, case-insensitive search |
| `IncidentTable: severity border colors` | SEV_BORDER map — critical/high/medium/low |
| `Alerts page: severity chips` | chip list completeness, default state, state transitions |
| `LiveIncidentFeed: behavior icon logic` | getBehaviorIcon() mapping for all 7 behavior types |
| `LiveIncidentFeed: severity color mapping` | getSeverityColor() for all severity levels incl. null |
| `IncidentDetail: status style mapping` | resolved / reviewing / open → correct CSS class |

---

## How to upload this as a GitHub branch

```bash
# 1. Create a new branch from main
git checkout main
git checkout -b feature/alerts-tests

# 2. Stage only this folder
git add tests/alerts/

# 3. Commit
git commit -m "test: unit tests for alerts feature (backend + frontend)"

# 4. Push the branch (GitHub will show a "Compare & pull request" button)
git push origin feature/alerts-tests
```

Then on GitHub → your repo → switch to the `feature/alerts-tests` branch to see the files,
or click **"Compare & pull request"** to open a PR.
