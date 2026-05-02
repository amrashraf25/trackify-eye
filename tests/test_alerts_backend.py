"""
====================================================================
Alerts Feature — Backend Unit Tests
Follows JUnit-style structure adapted for Python/pytest:
  • AAA Pattern  : Arrange → Act → Assert in every test
  • @BeforeEach  : pytest fixture called before each test (setup)
  • Assertions   : assertEquals / assertTrue / assertNull equivalents
  • Mockito      : unittest.mock patches external dependencies
  • Checklist    :
      ✅ Happy path  – normal inputs, expected behaviour
      ✅ Edge cases  – empty, null / None, zero, max values
      ✅ Negative    – invalid inputs, wrong types, bad requests
      ✅ No crashes  – all invalid paths return safe responses
====================================================================

Endpoints under test  (mirrors trackify_backend.py):
    GET  /alerts        – returns current alert counter dict
    POST /alerts/reset  – resets all counters and session timer

Filter logic under test  (mirrors IncidentTable.tsx filteredRecords):
    apply_filter(records, search_query, severity_filter)

Run:
    pip install pytest flask
    pytest tests/alerts/test_alerts_backend.py -v
"""

import time
import pytest
from collections import defaultdict
from flask import Flask, jsonify


# ════════════════════════════════════════════════════════════════
#  TEST APP FACTORY  (mock / fake of the real Flask endpoints)
#  This is the "mock()" equivalent from Mockito — we isolate
#  only the alert logic without loading the full AI backend.
# ════════════════════════════════════════════════════════════════
def build_alert_app(initial_alerts: dict | None = None):
    """
    Builds a minimal Flask test app that replicates the /alerts
    and /alerts/reset logic from trackify_backend.py.
    Mirrors: gateway = mock(PaymentGateway.class) in Mockito.
    """
    app = Flask("test_alerts")
    app.config["TESTING"] = True

    _alerts = defaultdict(int, initial_alerts or {})
    _session_start = [time.time()]

    @app.route("/alerts")
    def get_alerts():
        return jsonify(dict(_alerts))

    @app.route("/alerts/reset", methods=["POST"])
    def reset_alerts():
        for k in list(_alerts.keys()):
            _alerts[k] = 0
        _session_start[0] = time.time()
        return jsonify({"reset": True})

    app._alerts = _alerts          # expose for direct assertion in tests
    app._session_start = _session_start
    return app


# ────────────────────────────────────────────────────────────────
#  SHARED FIXTURES  (@BeforeEach equivalent)
# ────────────────────────────────────────────────────────────────
NORMAL_ALERTS = {
    "phone_use": 5,
    "sleeping":  3,
    "fighting":  1,
    "eating":    2,
}


@pytest.fixture
def client_normal():
    """@BeforeEach — standard alert state with multiple behaviour types."""
    app = build_alert_app(NORMAL_ALERTS)
    yield app.test_client(), app


@pytest.fixture
def client_empty():
    """@BeforeEach — empty alert state (no detections yet)."""
    app = build_alert_app({})
    yield app.test_client(), app


@pytest.fixture
def client_single():
    """@BeforeEach — only one behaviour type detected."""
    app = build_alert_app({"phone_use": 1})
    yield app.test_client(), app


# ════════════════════════════════════════════════════════════════
#  SECTION 1 — GET /alerts
#  Happy path, Edge cases, Negative cases, No crash
# ════════════════════════════════════════════════════════════════
class TestGetAlerts:

    # ── Happy Path ───────────────────────────────────────────────

    def test_happy_returns_200(self, client_normal):
        """Happy path: endpoint responds successfully."""
        # Arrange
        client, _ = client_normal
        # Act
        response = client.get("/alerts")
        # Assert
        assert response.status_code == 200

    def test_happy_response_is_json(self, client_normal):
        """Happy path: response Content-Type is application/json."""
        # Arrange
        client, _ = client_normal
        # Act
        response = client.get("/alerts")
        # Assert  (assertEquals on content-type)
        assert response.content_type.startswith("application/json")

    def test_happy_all_behaviour_types_present(self, client_normal):
        """Happy path: all seeded behaviour types appear in the response."""
        # Arrange
        client, _ = client_normal
        # Act
        data = client.get("/alerts").get_json()
        # Assert
        assert "phone_use" in data
        assert "sleeping"  in data
        assert "fighting"  in data
        assert "eating"    in data

    def test_happy_counts_match_seeded_values(self, client_normal):
        """Happy path: counter values equal what was seeded (assertEquals)."""
        # Arrange
        client, _ = client_normal
        # Act
        data = client.get("/alerts").get_json()
        # Assert
        assert data["phone_use"] == 5   # assertEquals(5, data["phone_use"])
        assert data["sleeping"]  == 3
        assert data["fighting"]  == 1
        assert data["eating"]    == 2

    def test_happy_all_values_are_integers(self, client_normal):
        """Happy path: every counter value is an integer (assertTrue)."""
        # Arrange
        client, _ = client_normal
        # Act
        data = client.get("/alerts").get_json()
        # Assert
        for key, val in data.items():
            assert isinstance(val, int), f"Expected int for '{key}', got {type(val)}"

    def test_happy_most_frequent_behaviour_identified(self, client_normal):
        """Happy path: phone_use is the highest counter."""
        # Arrange
        client, _ = client_normal
        # Act
        data = client.get("/alerts").get_json()
        top = max(data, key=data.get)
        # Assert
        assert top == "phone_use"

    def test_happy_single_type(self, client_single):
        """Happy path: single behaviour type returns correctly."""
        # Arrange
        client, _ = client_single
        # Act
        data = client.get("/alerts").get_json()
        # Assert
        assert data["phone_use"] == 1
        assert len(data) == 1

    # ── Edge Cases ───────────────────────────────────────────────

    def test_edge_empty_state_returns_empty_dict(self, client_empty):
        """Edge case: no detections yet — response is an empty dict (assertNotNull on dict)."""
        # Arrange
        client, _ = client_empty
        # Act
        data = client.get("/alerts").get_json()
        # Assert
        assert data is not None           # assertNotNull
        assert isinstance(data, dict)
        assert len(data) == 0

    def test_edge_zero_count_not_in_dict(self, client_empty):
        """Edge case: behaviour with 0 count was never added — key absent."""
        # Arrange
        client, _ = client_empty
        # Act
        data = client.get("/alerts").get_json()
        # Assert
        assert "sleeping" not in data

    def test_edge_total_sum_correct(self, client_normal):
        """Edge case: sum of all counters equals total expected detections (11)."""
        # Arrange
        client, _ = client_normal
        # Act
        data = client.get("/alerts").get_json()
        total = sum(data.values())
        # Assert  (assertEquals(11, total))
        assert total == 11

    def test_edge_high_volume_counter(self):
        """Edge case: very large counter value (max-like boundary)."""
        # Arrange
        app = build_alert_app({"phone_use": 999_999})
        client = app.test_client()
        # Act
        data = client.get("/alerts").get_json()
        # Assert
        assert data["phone_use"] == 999_999

    # ── Negative Tests ───────────────────────────────────────────

    def test_negative_post_to_alerts_not_allowed(self, client_normal):
        """Negative: POST to /alerts (read-only endpoint) returns 405."""
        # Arrange
        client, _ = client_normal
        # Act
        response = client.post("/alerts")
        # Assert
        assert response.status_code == 405

    def test_negative_unknown_route_returns_404(self, client_normal):
        """Negative: requesting a non-existent route returns 404."""
        # Arrange
        client, _ = client_normal
        # Act
        response = client.get("/alerts/unknown_path")
        # Assert
        assert response.status_code == 404

    # ── No Crashes ───────────────────────────────────────────────

    def test_no_crash_repeated_requests(self, client_normal):
        """No crash: ten consecutive GET /alerts calls all succeed."""
        # Arrange
        client, _ = client_normal
        # Act + Assert
        for _ in range(10):
            response = client.get("/alerts")
            assert response.status_code == 200


# ════════════════════════════════════════════════════════════════
#  SECTION 2 — POST /alerts/reset
#  Happy path, Edge cases, Negative cases, No crash
# ════════════════════════════════════════════════════════════════
class TestResetAlerts:

    # ── Happy Path ───────────────────────────────────────────────

    def test_happy_reset_returns_200(self, client_normal):
        """Happy path: reset endpoint responds successfully."""
        # Arrange
        client, _ = client_normal
        # Act
        response = client.post("/alerts/reset")
        # Assert
        assert response.status_code == 200

    def test_happy_reset_response_body(self, client_normal):
        """Happy path: response body contains reset=True (assertEquals)."""
        # Arrange
        client, _ = client_normal
        # Act
        data = client.post("/alerts/reset").get_json()
        # Assert
        assert data == {"reset": True}   # assertEquals({"reset": True}, data)

    def test_happy_all_counters_zero_after_reset(self, client_normal):
        """Happy path: every counter becomes 0 after reset (assertTrue)."""
        # Arrange
        client, _ = client_normal
        # Act
        client.post("/alerts/reset")
        data = client.get("/alerts").get_json()
        # Assert
        for key, val in data.items():
            assert val == 0, f"Counter '{key}' was {val} after reset, expected 0"

    def test_happy_can_accumulate_after_reset(self, client_normal):
        """Happy path: new counts recorded correctly after a reset."""
        # Arrange
        client, app = client_normal
        # Act
        client.post("/alerts/reset")
        app._alerts["phone_use"] += 3
        data = client.get("/alerts").get_json()
        # Assert  (assertEquals(3, data["phone_use"]))
        assert data["phone_use"] == 3

    def test_happy_multiple_resets_are_idempotent(self, client_normal):
        """Happy path: resetting twice leaves all counters at 0."""
        # Arrange
        client, _ = client_normal
        # Act
        client.post("/alerts/reset")
        client.post("/alerts/reset")
        data = client.get("/alerts").get_json()
        # Assert
        for val in data.values():
            assert val == 0

    # ── Edge Cases ───────────────────────────────────────────────

    def test_edge_reset_on_empty_state_safe(self, client_empty):
        """Edge case: reset when no alerts exist — no error (assertNotNull)."""
        # Arrange
        client, _ = client_empty
        # Act
        response = client.post("/alerts/reset")
        data = response.get_json()
        # Assert
        assert response.status_code == 200
        assert data is not None           # assertNotNull
        assert data["reset"] is True      # assertTrue

    def test_edge_reset_single_type(self, client_single):
        """Edge case: reset with only one type seeded — that counter becomes 0."""
        # Arrange
        client, _ = client_single
        # Act
        client.post("/alerts/reset")
        data = client.get("/alerts").get_json()
        # Assert
        assert data.get("phone_use", 0) == 0

    # ── Negative Tests ───────────────────────────────────────────

    def test_negative_get_to_reset_not_allowed(self, client_normal):
        """Negative: GET to /alerts/reset returns 405 (wrong method)."""
        # Arrange
        client, _ = client_normal
        # Act
        response = client.get("/alerts/reset")
        # Assert
        assert response.status_code == 405

    # ── No Crashes ───────────────────────────────────────────────

    def test_no_crash_reset_then_get(self, client_normal):
        """No crash: reset followed immediately by GET does not throw."""
        # Arrange
        client, _ = client_normal
        # Act
        reset_resp = client.post("/alerts/reset")
        get_resp   = client.get("/alerts")
        # Assert
        assert reset_resp.status_code == 200
        assert get_resp.status_code   == 200


# ════════════════════════════════════════════════════════════════
#  SECTION 3 — Severity + Search filter logic
#  Mirrors filteredRecords in IncidentTable.tsx
#  Mockito equivalent: logic isolated from DB/Supabase
# ════════════════════════════════════════════════════════════════

# ── Fixture data (@BeforeEach equivalent — module-level constant) ──
SAMPLE_RECORDS = [
    {"id": "1", "incident_type": "phone_use", "severity": "high",     "room_number": "101"},
    {"id": "2", "incident_type": "sleeping",  "severity": "medium",   "room_number": "202"},
    {"id": "3", "incident_type": "fighting",  "severity": "critical", "room_number": "101"},
    {"id": "4", "incident_type": "eating",    "severity": "low",      "room_number": "303"},
    {"id": "5", "incident_type": "phone_use", "severity": "high",     "room_number": "202"},
]


def apply_filter(records: list, search_query: str = "", severity_filter: str = "all") -> list:
    """
    Mirror of filteredRecords useMemo in IncidentTable.tsx.
    Mockito equivalent: when(filter.apply(...)).thenReturn(expected)
    """
    return [
        r for r in records
        if (severity_filter == "all" or r["severity"] == severity_filter)
        and (
            r["incident_type"].lower().find(search_query.lower()) != -1
            or f"room {r['room_number']}".lower().find(search_query.lower()) != -1
        )
    ]


class TestAlertFilterLogic:

    # ── Happy Path ───────────────────────────────────────────────

    def test_happy_all_filter_returns_all(self):
        """Happy path: 'all' severity returns every record."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, severity_filter="all")
        # Assert  (assertEquals(5, len(result)))
        assert len(result) == 5

    def test_happy_filter_high_severity(self):
        """Happy path: filtering 'high' returns only high-severity records."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, severity_filter="high")
        # Assert
        assert len(result) == 2
        assert all(r["severity"] == "high" for r in result)  # assertTrue

    def test_happy_filter_critical_severity(self):
        """Happy path: filtering 'critical' returns exactly one record."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, severity_filter="critical")
        # Assert
        assert len(result) == 1
        assert result[0]["id"] == "3"

    def test_happy_search_by_incident_type(self):
        """Happy path: search 'phone' matches both phone_use records."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, search_query="phone")
        # Assert
        assert len(result) == 2
        assert all("phone" in r["incident_type"] for r in result)

    def test_happy_search_by_room(self):
        """Happy path: search 'room 101' returns only room 101 records."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, search_query="room 101")
        # Assert
        assert len(result) == 2
        assert all(r["room_number"] == "101" for r in result)

    def test_happy_combined_search_and_severity(self):
        """Happy path: combining search + severity narrows results correctly."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, search_query="phone", severity_filter="high")
        # Assert
        assert len(result) == 2
        assert all(r["severity"] == "high" for r in result)

    # ── Edge Cases ───────────────────────────────────────────────

    def test_edge_empty_records_returns_empty(self):
        """Edge case: empty input list — result is empty (assertNotNull + length 0)."""
        # Arrange
        records = []
        # Act
        result = apply_filter(records, search_query="phone", severity_filter="high")
        # Assert
        assert result is not None     # assertNotNull
        assert len(result) == 0

    def test_edge_empty_search_returns_all(self):
        """Edge case: empty search string does not exclude any records."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, search_query="")
        # Assert
        assert len(result) == 5

    def test_edge_filter_low_severity(self):
        """Edge case: minimum severity 'low' returns exactly one record."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, severity_filter="low")
        # Assert
        assert len(result) == 1
        assert result[0]["severity"] == "low"

    def test_edge_single_record_list(self):
        """Edge case: list with one record — filter returns it or empty."""
        # Arrange
        records = [{"id": "x", "incident_type": "sleeping", "severity": "medium", "room_number": "500"}]
        # Act
        result_match = apply_filter(records, severity_filter="medium")
        result_no    = apply_filter(records, severity_filter="high")
        # Assert
        assert len(result_match) == 1
        assert len(result_no)    == 0

    # ── Negative Tests ───────────────────────────────────────────

    def test_negative_unknown_severity_returns_empty(self):
        """Negative: severity value not in the defined set returns empty list."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, severity_filter="extreme")
        # Assert
        assert result == []

    def test_negative_search_no_match_returns_empty(self):
        """Negative: search query that matches nothing returns empty list."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result = apply_filter(records, search_query="xyz_not_found_at_all")
        # Assert
        assert result == []

    def test_negative_case_insensitive_search(self):
        """Negative: uppercase search should still match (case-insensitive)."""
        # Arrange
        records = SAMPLE_RECORDS
        # Act
        result_upper = apply_filter(records, search_query="PHONE")
        result_mixed = apply_filter(records, search_query="PhOnE")
        # Assert
        assert len(result_upper) == 2
        assert len(result_mixed) == 2

    # ── No Crashes ───────────────────────────────────────────────

    def test_no_crash_none_severity_treated_as_no_match(self):
        """No crash: record with None severity does not throw exception."""
        # Arrange
        records = [{"id": "z", "incident_type": "eating", "severity": None, "room_number": "100"}]
        # Act + Assert (must not raise)
        try:
            result = apply_filter(records, severity_filter="high")
            assert isinstance(result, list)
        except Exception as e:
            pytest.fail(f"apply_filter raised an exception: {e}")

    def test_no_crash_empty_search_and_all_filter(self):
        """No crash: default parameters on empty list do not raise."""
        # Arrange + Act + Assert
        result = apply_filter([])
        assert result == []
