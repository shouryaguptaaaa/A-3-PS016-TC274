import pytest

from app.simulation.metrics import compare_metrics, compute_algorithm_metrics, delay_stats

COUNTERS = {"dt": 0.5, "connected_steps": 100, "rsrp_sum": -9000.0, "outage_steps": 4, "handover_steps": 6}


def _ho(success=True, pp=False, dec=0.0, ex=0.5):
    return {"type": "handover", "success": success, "ping_pong": pp,
            "decision_delay_s": dec, "execution_delay_s": ex}


def test_delay_stats_empty_and_values():
    assert delay_stats([])["n"] == 0 and delay_stats([])["mean"] is None
    s = delay_stats([1.0, 2.0, 3.0])
    assert s["mean"] == 2.0 and s["min"] == 1.0 and s["max"] == 3.0 and s["median"] == 2.0


def test_rates_use_documented_denominators():
    events = [_ho(), _ho(pp=True), _ho(success=False), {"type": "rlf", "time_s": 3.0, "cause": "handover_failure"}]
    m = compute_algorithm_metrics(events, COUNTERS, 60.0)
    assert m["handover_attempts"] == 3 and m["handover_count"] == 2
    assert m["failure_rate"] == pytest.approx(1 / 3)       # failures / attempts
    assert m["ping_pong_rate"] == pytest.approx(1 / 2)     # ping-pong / successful
    assert m["rlf_count"] == 1
    assert m["outage_duration_s"] == pytest.approx(2.0)
    assert m["interruption_s"] == pytest.approx(3.0)
    assert m["outage_ratio"] == pytest.approx(2.0 / 60.0)
    assert m["mean_serving_rsrp_dbm"] == pytest.approx(-90.0)


def test_rates_are_none_without_events():
    m = compute_algorithm_metrics([], COUNTERS, 60.0)
    assert m["failure_rate"] is None and m["ping_pong_rate"] is None
    assert m["handover_count"] == 0 and m["mean_decision_delay_s"] is None


def test_delay_components_add_up():
    m = compute_algorithm_metrics([_ho(dec=1.0, ex=0.5)], COUNTERS, 60.0)
    assert m["total_delay_s"]["mean"] == pytest.approx(1.5)


def test_compare_metrics_winners():
    base = compute_algorithm_metrics([_ho(), _ho(pp=True), _ho(pp=True)], COUNTERS, 60.0)
    prop = compute_algorithm_metrics([_ho(dec=1.0)], COUNTERS, 60.0)
    rows = {r["metric"]: r for r in compare_metrics(base, prop)}
    assert rows["handover_count"]["winner"] == "proposed"
    assert rows["handover_count"]["relative_improvement_pct"] == pytest.approx((3 - 1) / 3 * 100)
    assert rows["mean_decision_delay_s"]["winner"] == "baseline"  # TTT adds delay
    assert rows["rlf_count"]["winner"] == "tie"
    assert "Simulated finding" in rows["handover_count"]["explanation"]


def test_compare_metrics_not_available_when_undefined():
    base = compute_algorithm_metrics([], COUNTERS, 60.0)
    prop = compute_algorithm_metrics([_ho()], COUNTERS, 60.0)
    rows = {r["metric"]: r for r in compare_metrics(base, prop)}
    assert rows["failure_rate"]["winner"] == "n/a"
