import numpy as np
import pytest

from app.simulation.algorithms import BaselineStrongestCell, ProposedHysteresisTTT


def _proposed(hyst=3.0, ttt=1.0, alpha=1.0, min_dbm=-110.0):
    a = ProposedHysteresisTTT(hyst, ttt, 0.5, alpha, min_dbm)
    a.reset(3)
    return a


def test_baseline_triggers_on_stronger_neighbour():
    a = BaselineStrongestCell(0.0)
    a.reset(3)
    d = a.decide(4, 0, np.array([-90.0, -85.0, -100.0]))
    assert d is not None and d.target == 1 and d.first_condition_step == 4


def test_baseline_no_trigger_when_serving_is_best():
    a = BaselineStrongestCell(0.0)
    a.reset(3)
    assert a.decide(0, 0, np.array([-80.0, -85.0, -100.0])) is None


def test_baseline_optional_hysteresis():
    a = BaselineStrongestCell(3.0)
    a.reset(2)
    assert a.decide(0, 0, np.array([-90.0, -88.0])) is None  # only 2 dB better
    assert a.decide(0, 0, np.array([-90.0, -86.0])) is not None


def test_proposed_requires_ttt():
    a = _proposed(ttt=1.0)
    m = np.array([-90.0, -80.0, -120.0])  # neighbour 10 dB better
    results = []
    for k in range(3):
        a.observe(k, m)
        results.append(a.decide(k, 0, m))
    assert results[0] is None and results[1] is None
    assert results[2] is not None and results[2].target == 1
    assert results[2].first_condition_step == 0


def test_proposed_hysteresis_blocks_small_advantage():
    a = _proposed(hyst=3.0, ttt=0.0)
    m = np.array([-90.0, -88.0, -120.0])  # only 2 dB better
    for k in range(5):
        a.observe(k, m)
        assert a.decide(k, 0, m) is None


def test_proposed_ttt_timer_resets_when_condition_breaks():
    a = _proposed(ttt=1.0)
    good = np.array([-90.0, -80.0, -120.0])
    bad = np.array([-80.0, -90.0, -120.0])
    seq = [good, good, bad, good, good]
    out = []
    for k, m in enumerate(seq):
        a.observe(k, m)
        out.append(a.decide(k, 0, m))
    assert all(o is None for o in out)  # never held 1.0 s continuously
    a.observe(5, good)
    d = a.decide(5, 0, good)
    assert d is not None and d.first_condition_step == 3


def test_proposed_urgent_bypass_below_threshold():
    a = _proposed(ttt=5.0, min_dbm=-110.0)
    m = np.array([-115.0, -100.0, -120.0])
    a.observe(0, m)
    d = a.decide(0, 0, m)
    assert d is not None and d.target == 1


def test_proposed_zero_ttt_triggers_immediately():
    a = _proposed(ttt=0.0)
    m = np.array([-95.0, -80.0, -120.0])
    a.observe(0, m)
    assert a.decide(0, 0, m) is not None


def test_proposed_filtering_smooths_measurements():
    a = _proposed(alpha=0.5)
    a.observe(0, np.array([0.0, 0.0, 0.0]))
    a.observe(1, np.array([10.0, 0.0, 0.0]))
    assert a.filtered.tolist() == [5.0, 0.0, 0.0]


def test_proposed_timer_cleared_on_serving_change():
    a = _proposed(ttt=1.0)
    m = np.array([-90.0, -80.0, -120.0])
    a.observe(0, m)
    a.decide(0, 0, m)
    a.notify_serving_change(1)
    assert a.candidate is None and a.cand_start is None
