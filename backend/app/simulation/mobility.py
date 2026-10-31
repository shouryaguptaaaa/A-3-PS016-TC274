"""Geometry and mobility: cells on a line, UE moving along a straight corridor.

Cell i sits at (i * spacing, offset). The UE starts at x = start_x, y = 0 and
moves with constant speed in +x, so it passes every cell in index order.
"""
from __future__ import annotations

import numpy as np


def cell_positions(num_cells: int, spacing_m: float, offset_m: float) -> np.ndarray:
    return np.array([[i * spacing_m, offset_m] for i in range(num_cells)], dtype=float)


def ue_trajectory(steps: int, time_step_s: float, speed_kmh: float, start_x_m: float = 0.0):
    t = np.arange(steps + 1) * time_step_s
    x = start_x_m + (speed_kmh / 3.6) * t
    y = np.zeros_like(t)
    return t, x, y


def distances_to_cells(x: np.ndarray, y: np.ndarray, cells: np.ndarray) -> np.ndarray:
    """Return array shape (samples, cells) of Euclidean distances in metres."""
    dx = x[:, None] - cells[None, :, 0]
    dy = y[:, None] - cells[None, :, 1]
    return np.sqrt(dx * dx + dy * dy)
