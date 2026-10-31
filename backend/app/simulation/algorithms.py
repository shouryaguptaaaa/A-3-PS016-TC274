"""Handover decision strategies.

Both strategies implement the same small interface so the engine can run them
in lock-step on identical measurements (paired comparison).

BASELINE  - "strongest cell" rule
    Trigger immediately when the best neighbour's measured RSRP exceeds the
    serving cell's measured RSRP by more than `baseline_hysteresis_db`
    (default 0 dB). No time-to-trigger, no filtering.

PROPOSED  - filtered A3-style event with hysteresis and TTT
    1. Layer-3 style exponential filtering of every cell's measurements:
           F[k] = alpha * M[k] + (1 - alpha) * F[k-1]
    2. Entering condition: best neighbour F > serving F + hysteresis.
    3. The condition for the SAME best neighbour must hold continuously for
       time-to-trigger (TTT); any interruption or change of best neighbour
       restarts the timer.
    4. Urgent bypass: if the serving cell's filtered RSRP is below the minimum
       serving threshold, TTT is skipped (service-continuity safeguard).
This rule is a candidate, not a proven improvement; it is evaluated against the
baseline by the experiments.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

from .params import SimParams


@dataclass(frozen=True)
class Decision:
    target: int
    first_condition_step: int  # step at which the trigger condition first held


class HandoverAlgorithm:
    name = "base"

    def reset(self, num_cells: int) -> None:  # pragma: no cover - interface
        pass

    def observe(self, k: int, meas: np.ndarray) -> None:
        """Called every step with the new measurements (even during execution)."""

    def decide(self, k: int, serving: int, meas: np.ndarray) -> Optional[Decision]:
        raise NotImplementedError

    def notify_serving_change(self, k: int) -> None:
        """Serving cell changed (handover success or re-establishment)."""


def _best_neighbour(values: np.ndarray, serving: int) -> int:
    masked = values.astype(float).copy()
    masked[serving] = -np.inf
    return int(np.argmax(masked))


class BaselineStrongestCell(HandoverAlgorithm):
    name = "baseline"

    def __init__(self, hysteresis_db: float = 0.0):
        self.hysteresis_db = hysteresis_db

    def reset(self, num_cells: int) -> None:
        self.num_cells = num_cells

    def decide(self, k, serving, meas):
        if len(meas) < 2:
            return None
        best = _best_neighbour(meas, serving)
        if meas[best] > meas[serving] + self.hysteresis_db:
            return Decision(best, k)
        return None


class ProposedHysteresisTTT(HandoverAlgorithm):
    name = "proposed"

    def __init__(self, hysteresis_db, ttt_s, time_step_s, filter_alpha, min_signal_dbm):
        self.hysteresis_db = hysteresis_db
        self.ttt_s = ttt_s
        self.dt = time_step_s
        self.alpha = filter_alpha
        self.min_signal_dbm = min_signal_dbm

    def reset(self, num_cells: int) -> None:
        self.num_cells = num_cells
        self.filtered: Optional[np.ndarray] = None
        self.candidate: Optional[int] = None
        self.cand_start: Optional[int] = None

    def observe(self, k, meas):
        if self.filtered is None:
            self.filtered = np.array(meas, dtype=float)
        else:
            self.filtered = self.alpha * meas + (1.0 - self.alpha) * self.filtered

    def notify_serving_change(self, k):
        self.candidate = None
        self.cand_start = None

    def decide(self, k, serving, meas):
        if len(meas) < 2 or self.filtered is None:
            return None
        f = self.filtered
        best = _best_neighbour(f, serving)
        if not f[best] > f[serving] + self.hysteresis_db:
            self.candidate = None
            self.cand_start = None
            return None
        if self.candidate != best:
            self.candidate = best
            self.cand_start = k
        elapsed = (k - self.cand_start) * self.dt
        urgent = f[serving] < self.min_signal_dbm
        if urgent or elapsed >= self.ttt_s - 1e-9:
            return Decision(best, self.cand_start)
        return None


def build_algorithm(name: str, p: SimParams) -> HandoverAlgorithm:
    if name == "baseline":
        algo: HandoverAlgorithm = BaselineStrongestCell(p.baseline_hysteresis_db)
    elif name == "proposed":
        algo = ProposedHysteresisTTT(
            p.hysteresis_db, p.ttt_s, p.time_step_s, p.filter_alpha, p.min_signal_dbm
        )
    else:
        raise ValueError(f"Unknown algorithm: {name}")
    algo.reset(p.num_cells)
    return algo
