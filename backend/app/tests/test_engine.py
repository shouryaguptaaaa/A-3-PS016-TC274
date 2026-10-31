import numpy as np
import pytest

from app.simulation.engine import Simulation, run_simulation
from app.simulation.params import SimParams


def test_deterministic_for_same_seed():
    assert run_simulation(SimParams()) == run_simulation(SimParams())


def test_different_seed_changes_measurements():
    a = run_simulation(SimParams(seed=1))
    b = run_simulation(SimParams(seed=2))
    assert a["signal"]["measured_dbm"] != b["signal"]["measured_dbm"]
    assert a["signal"]["true_dbm"] == b["signal"]["true_dbm"]  # truth is seed independent


def test_paired_comparison_shares_measurements():
    both = Simulation(SimParams())
    only = Simulation(SimParams(algorithms=("baseline",)))
    assert np.array_equal(both.meas, only.meas)
    r_both = run_simulation(SimParams())
    r_only = run_simulation(SimParams(algorithms=("baseline",)))
    assert r_both["algorithms"]["baseline"] == r_only["algorithms"]["baseline"]


def test_noise_free_run_follows_corridor_without_ping_pong():
    p = SimParams(noise_std_db=0.0)
    r = run_simulation(p)
    for name in ("baseline", "proposed"):
        m = r["algorithms"][name]["metrics"]
        assert m["handover_count"] == 2
        assert m["ping_pong_events"] == 0
        assert m["handover_failures"] == 0
        assert m["outage_duration_s"] == 0.0
        evs = [e for e in r["algorithms"][name]["events"] if e["type"] == "handover"]
        assert [(e["source_cell"], e["target_cell"]) for e in evs] == [(0, 1), (1, 2)]


def test_trajectory_matches_speed_and_duration():
    r = run_simulation(SimParams(speed_kmh=72.0, duration_s=10.0, time_step_s=1.0))
    assert r["trajectory"]["x_m"][-1] == pytest.approx(200.0)
    assert len(r["trajectory"]["time_s"]) == 11
    assert r["metadata"]["duration_s"] == 10.0


def test_execution_delay_is_rounded_up_to_whole_steps():
    p = SimParams(noise_std_db=0.0, exec_delay_s=0.3, time_step_s=0.5)
    r = run_simulation(p)
    evs = [e for e in r["algorithms"]["baseline"]["events"] if e["type"] == "handover"]
    assert evs and all(e["execution_delay_s"] == pytest.approx(0.5) for e in evs)


def test_zero_execution_delay_completes_immediately():
    r = run_simulation(SimParams(noise_std_db=0.0, exec_delay_s=0.0))
    evs = [e for e in r["algorithms"]["baseline"]["events"] if e["type"] == "handover"]
    assert evs and all(e["execution_delay_s"] == 0.0 for e in evs)
    assert r["algorithms"]["baseline"]["metrics"]["interruption_s"] == 0.0


def test_signal_always_below_threshold_causes_outage_and_rlf():
    r = run_simulation(SimParams(noise_std_db=0.0, min_signal_dbm=-60.0))
    m = r["algorithms"]["baseline"]["metrics"]
    assert m["outage_duration_s"] > 0
    assert m["rlf_count"] > 0
    assert any(e["type"] == "rlf" for e in r["algorithms"]["baseline"]["events"])


def test_handover_failure_when_target_too_weak():
    # Very noisy measurements trigger early (baseline); a high threshold then fails some attempts.
    found = False
    for seed in range(40):
        r = run_simulation(SimParams(noise_std_db=8.0, min_signal_dbm=-104.0, seed=seed,
                                     algorithms=("baseline",)))
        evs = [e for e in r["algorithms"]["baseline"]["events"] if e["type"] == "handover" and not e["success"]]
        if evs:
            found = True
            assert evs[0]["failure_reason"] in ("source_below_threshold", "target_below_threshold")
            m = r["algorithms"]["baseline"]["metrics"]
            assert m["handover_failures"] >= 1 and 0 < m["failure_rate"] <= 1
            assert m["rlf_count"] >= 1
            break
    assert found


def test_metric_consistency_on_noisy_run():
    r = run_simulation(SimParams(noise_std_db=6.0, seed=7))
    for name, a in r["algorithms"].items():
        m = a["metrics"]
        assert m["handover_attempts"] == m["handover_count"] + m["handover_failures"]
        assert m["ping_pong_events"] <= m["handover_count"]
        if m["ping_pong_rate"] is not None:
            assert 0 <= m["ping_pong_rate"] <= 1
        assert m["outage_duration_s"] + m["interruption_s"] <= r["metadata"]["duration_s"] + 1e-9
        assert len(a["serving_cell"]) == len(r["trajectory"]["time_s"])


def test_step_by_step_matches_batch_run():
    p = SimParams(duration_s=10.0)
    sim = Simulation(p)
    calls = 0
    while not sim.done:
        s = sim.step()
        calls += 1
        assert s["k"] == calls - 1
    assert calls == p.steps + 1
    assert sim.result() == run_simulation(p)


def test_single_algorithm_has_no_comparison():
    r = run_simulation(SimParams(algorithms=("proposed",)))
    assert list(r["algorithms"]) == ["proposed"] and r["comparison"] == []


def test_comparison_present_for_both_algorithms():
    r = run_simulation(SimParams())
    assert {c["metric"] for c in r["comparison"]} >= {"handover_count", "ping_pong_rate", "failure_rate"}
    assert all(c["winner"] in ("baseline", "proposed", "tie", "n/a") for c in r["comparison"])
