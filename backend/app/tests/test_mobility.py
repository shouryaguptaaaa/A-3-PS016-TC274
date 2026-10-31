import numpy as np
import pytest

from app.simulation.mobility import cell_positions, distances_to_cells, ue_trajectory


def test_ue_moves_at_constant_speed():
    t, x, y = ue_trajectory(steps=10, time_step_s=0.5, speed_kmh=36.0)  # 10 m/s
    assert len(t) == 11
    assert x[-1] == pytest.approx(50.0)
    assert np.allclose(np.diff(x), 5.0)
    assert np.all(y == 0)


def test_cell_positions_layout():
    cells = cell_positions(3, 500.0, 30.0)
    assert cells.shape == (3, 2)
    assert cells[:, 0].tolist() == [0.0, 500.0, 1000.0]
    assert np.all(cells[:, 1] == 30.0)


def test_distances_shape_and_values():
    cells = cell_positions(2, 400.0, 30.0)
    t, x, y = ue_trajectory(2, 1.0, 36.0)
    d = distances_to_cells(x, y, cells)
    assert d.shape == (3, 2)
    assert d[0, 0] == pytest.approx(30.0)
    assert d[0, 1] == pytest.approx(np.hypot(400.0, 30.0))
