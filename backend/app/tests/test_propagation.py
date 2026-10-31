import math

import numpy as np
import pytest

from app.simulation.propagation import path_loss_db, received_power_dbm


def test_path_loss_at_reference_distance_equals_reference():
    assert path_loss_db(20.0, 38.0, 3.2, 20.0) == pytest.approx(38.0)


def test_path_loss_log_distance_formula():
    # 10x the reference distance adds 10*n dB
    assert path_loss_db(200.0, 38.0, 3.2, 20.0) == pytest.approx(38.0 + 32.0)


def test_path_loss_flat_below_reference_distance():
    assert path_loss_db(1.0, 38.0, 3.2, 20.0) == pytest.approx(38.0)


def test_received_power_decreases_with_distance():
    d = np.array([30.0, 100.0, 300.0, 900.0])
    p = received_power_dbm(d, -30.0, 38.0, 3.2, 20.0)
    assert np.all(np.diff(p) < 0)


def test_received_power_value():
    # d = 20 m -> PL = 38 -> RSRP = -30 - 38
    assert received_power_dbm(20.0, -30.0, 38.0, 3.2, 20.0) == pytest.approx(-68.0)


def test_higher_exponent_means_more_loss():
    assert path_loss_db(500.0, 38.0, 4.0, 20.0) > path_loss_db(500.0, 38.0, 2.0, 20.0)
    assert math.isfinite(float(path_loss_db(500.0, 38.0, 4.0, 20.0)))
