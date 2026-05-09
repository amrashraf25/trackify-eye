# Daily Behavior Summary — Unit Tests

Tests covering all three Acceptance Criteria for the Daily Summary feature.

## Folder structure

```
tests/
└── daily_summary/
    ├── test_daily_summary_api.py              ← Python/Flask backend tests
    ├── test_daily_summary_frontend.test.tsx   ← React/Vitest frontend tests
    └── README.md                              ← This file
```

---

## Running the backend tests (Python)

```bash
# 1. Install test dependencies (once)
pip install pytest pytest-mock flask requests

# 2. Run from the project root
pytest tests/daily_summary/test_daily_summary_api.py -v
```

Expected output:
```
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC1_IncidentRecording::test_incidents_included_in_response
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC1_IncidentRecording::test_incident_fields_preserved
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC1_IncidentRecording::test_all_behavior_types_present
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC2_DailyAggregation::test_total_count
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC2_DailyAggregation::test_by_type_counts
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC2_DailyAggregation::test_by_severity_counts
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC2_DailyAggregation::test_top_behavior_is_most_frequent
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC2_DailyAggregation::test_date_in_response_matches_request
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC2_DailyAggregation::test_invalid_date_returns_400
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC3_SummaryDashboardShape::test_required_top_level_keys
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC3_SummaryDashboardShape::test_by_type_is_dict_of_ints
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC3_SummaryDashboardShape::test_by_severity_is_dict_of_ints
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC3_SummaryDashboardShape::test_total_is_integer
PASSED tests/daily_summary/test_daily_summary_api.py::TestAC3_SummaryDashboardShape::test_empty_day_returns_valid_shape
PASSED tests/daily_summary/test_daily_summary_api.py::TestAggregationLogicUnit::test_single_incident
PASSED tests/daily_summary/test_daily_summary_api.py::TestAggregationLogicUnit::test_empty_incidents
PASSED tests/daily_summary/test_daily_summary_api.py::TestAggregationLogicUnit::test_mixed_behaviors
PASSED tests/daily_summary/test_daily_summary_api.py::TestAggregationLogicUnit::test_unknown_type_fallback
PASSED tests/daily_summary/test_daily_summary_api.py::TestAggregationLogicUnit::test_total_equals_sum_of_by_type
```

---

## Running the frontend tests (React/Vitest)

```bash
# 1. Make sure dev dependencies are installed
npm install

# 2. Run only this test file
npx vitest run tests/daily_summary/test_daily_summary_frontend.test.tsx
```

> **Note:** Vitest must have `@testing-library/react` and `@testing-library/jest-dom` installed.
> If missing: `npm install -D @testing-library/react @testing-library/jest-dom`

---

## What each test class covers

| Class / describe | AC | What it verifies |
|---|---|---|
| `TestAC1_IncidentRecording` | AC1 | Incidents from Supabase appear in the response |
| `TestAC2_DailyAggregation` | AC2 | Counts per type/severity are accurate; top_behavior is correct |
| `TestAC3_SummaryDashboardShape` | AC3 | Response JSON has all keys the frontend card expects |
| `TestAggregationLogicUnit` | AC2 | Pure-unit tests of the counting algorithm (no HTTP) |
| `AC1: Incident recording rendered` | AC1 | Behavior type labels render in the card |
| `AC2: Daily aggregation displayed` | AC2 | Total, per-type counts, top-behavior badge visible |
| `AC3: Staff summary dashboard sections` | AC3 | All sections (Total, severity pills, breakdown, nav) rendered; empty-day and error states work |
