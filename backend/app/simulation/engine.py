"""Deterministic, step-by-step handover simulation engine.

Paired design: the UE trajectory, true RSRP and the measurement-noise matrix are
generated ONCE from the seed and shared by every algorithm, so differences in
the results come only from the decision rules.

Per time step k (time t = k*dt) and per algorithm the order is:
  1. complete re-establishment (re-select strongest measured cell)
  2. complete a pending handover (success/failure rules below)
  3. if idle, ask the algorithm for a decision; start execution
  4. classify the state for [t, t+dt): connected | handover | outage

Handover SUCCESS requires BOTH
  (a) TRUE source RSRP at execution start  >= min_signal_dbm  (command received)
  (b) TRUE target RSRP at execution completion >= min_signal_dbm (access succeeds)
A failed handover causes a radio-link failure followed by re-establishment.
Radio-link failure is also declared when the serving cell's TRUE RSRP stays
below min_signal_dbm for rlf_timer_s.
"""
from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np

from .algorithms import build_algorithm
from .metrics import compare_metrics, compute_algorithm_metrics
from .mobility import cell_positions, distances_to_cells, ue_trajectory
from .params import ENGINE_VERSION, SimParams
from .propagation import received_power_dbm

ASSUMPTIONS = [
    "Straight-line corridor mobility at constant speed; cells on a line with a fixed lateral offset.",
    "Log-distance path loss with a flat near field; no shadowing, fast fading, interference or load.",
    "Measurements are true RSRP plus independent zero-mean Gaussian noise (dB).",
    "Execution delay is rounded up to a whole number of time steps.",
    "Handover success/failure uses deterministic signal-threshold rules (see methodology).",
    "Simplified model: not validated against real radio-network measurements.",
]


class _AlgoRun:
    def __init__(self, name: str, sim: "Simulation"):
        self.name = name
        self.sim = sim
        self.p = sim.p
        self.algo = build_algorithm(name, sim.p)
        self.serving: Optional[int] = int(np.argmax(sim.meas[0]))  # initial cell selection
        self.pending: Optional[dict] = None
        self.reest_end: Optional[int] = None
        self.below = 0
        self.last_ho: Optional[dict] = None
        self.events: List[dict] = []
        self.serving_series: List[int] = []
        self.state_series: List[str] = []
        self.c = {"dt": self.p.time_step_s, "connected_steps": 0, "rsrp_sum": 0.0,
                  "outage_steps": 0, "handover_steps": 0}
        self._new: List[dict] = []

    def _emit(self, ev: dict) -> None:
        ev["id"] = len(self.events) + 1
        ev["algorithm"] = self.name
        self.events.append(ev)
        self._new.append(ev)

    def _start_rlf(self, k: int, cause: str) -> None:
        self.reest_end = k + self.p.reest_steps
        self.serving = None
        self.pending = None
        self.below = 0
        self.last_ho = None
        self._emit({"type": "rlf", "time_s": float(self.sim.t[k]), "cause": cause})

    def _complete(self, k: int) -> None:
        sim, p, pend = self.sim, self.p, self.pending
        thr = p.min_signal_dbm
        src_ok = pend["source_true"] >= thr
        tgt_true = float(sim.true[k][pend["target"]])
        tgt_ok = tgt_true >= thr
        success = src_ok and tgt_ok
        reason = "ok" if success else ("source_below_threshold" if not src_ok else "target_below_threshold")
        t = float(sim.t[k])
        pp = False
        if success:
            lh = self.last_ho
            if (lh and lh["src"] == pend["target"] and lh["tgt"] == pend["source"]
                    and t - lh["t"] <= p.ping_pong_window_s + 1e-9):
                pp = True
            self.last_ho = {"src": pend["source"], "tgt": pend["target"], "t": t}
        self._emit({
            "type": "handover", "trigger_time_s": float(sim.t[pend["start_k"]]), "completion_time_s": t,
            "source_cell": pend["source"], "target_cell": pend["target"], "success": success,
            "failure_reason": None if success else reason, "ping_pong": pp,
            "decision_delay_s": float((pend["start_k"] - pend["first_k"]) * p.time_step_s),
            "execution_delay_s": float((k - pend["start_k"]) * p.time_step_s),
            "source_rsrp_dbm": round(float(pend["source_true"]), 2), "target_rsrp_dbm": round(tgt_true, 2),
        })
        self.pending = None
        if success:
            self.serving = pend["target"]
            self.algo.notify_serving_change(k)
        else:
            self._start_rlf(k, "handover_failure")

    def step(self, k: int) -> dict:
        sim, p = self.sim, self.p
        meas, true = sim.meas[k], sim.true[k]
        last = k >= p.steps
        self._new = []
        self.algo.observe(k, meas)
        if self.reest_end is not None and k >= self.reest_end:
            self.serving = int(np.argmax(meas))
            self.reest_end = None
            self.below = 0
            self.last_ho = None
            self.algo.notify_serving_change(k)
            self._emit({"type": "reestablishment", "time_s": float(sim.t[k]), "cell": self.serving})
        if self.pending and k >= self.pending["end_k"]:
            self._complete(k)
        if self.serving is not None and self.pending is None and self.reest_end is None and not last:
            d = self.algo.decide(k, self.serving, meas)
            if d is not None:
                self.pending = {"source": self.serving, "target": d.target, "start_k": k,
                                "end_k": k + p.exec_steps, "first_k": d.first_condition_step,
                                "source_true": float(true[self.serving])}
                if self.pending["end_k"] <= k:
                    self._complete(k)
        # state classification
        if self.reest_end is not None:
            state = "outage"
        elif self.pending is not None:
            state = "handover"
        elif true[self.serving] < p.min_signal_dbm:
            self.below += 1
            if self.below >= p.rlf_steps and not last:
                self._start_rlf(k, "sustained_low_signal")
            state = "outage"
        else:
            self.below = 0
            state = "connected"
        self.serving_series.append(-1 if self.serving is None else int(self.serving))
        self.state_series.append(state)
        if not last:
            if state == "outage":
                self.c["outage_steps"] += 1
            elif state == "handover":
                self.c["handover_steps"] += 1
            else:
                self.c["connected_steps"] += 1
                self.c["rsrp_sum"] += float(true[self.serving])
        return {"serving": self.serving_series[-1], "state": state}

    def new_events(self) -> List[dict]:
        return list(self._new)

    def result(self) -> dict:
        return {
            "algorithm": self.name,
            "serving_cell": self.serving_series,
            "state": self.state_series,
            "events": self.events,
            "metrics": compute_algorithm_metrics(self.events, self.c, self.p.duration_actual),
        }


class Simulation:
    """Step-by-step simulation: call step() until done is True, then result()."""

    def __init__(self, p: SimParams):
        self.p = p
        rng = np.random.default_rng(p.seed)
        self.cells = cell_positions(p.num_cells, p.cell_spacing_m, p.cell_offset_m)
        self.t, self.x, self.y = ue_trajectory(p.steps, p.time_step_s, p.speed_kmh)
        dist = distances_to_cells(self.x, self.y, self.cells)
        self.true = received_power_dbm(dist, p.tx_power_dbm, p.path_loss_ref_db,
                                       p.path_loss_exponent, p.reference_distance_m)
        self.noise = rng.normal(0.0, p.noise_std_db, size=self.true.shape)
        self.meas = self.true + self.noise
        self.k = 0
        self.runs: Dict[str, _AlgoRun] = {n: _AlgoRun(n, self) for n in p.algorithms}

    @property
    def done(self) -> bool:
        return self.k > self.p.steps

    def step(self) -> dict:
        if self.done:
            raise RuntimeError("simulation already finished")
        k = self.k
        algos = {n: r.step(k) for n, r in self.runs.items()}
        events = [e for r in self.runs.values() for e in r.new_events()]
        self.k += 1
        return {
            "k": k, "t": float(self.t[k]), "x": float(self.x[k]), "y": float(self.y[k]),
            "true": [round(float(v), 2) for v in self.true[k]],
            "meas": [round(float(v), 2) for v in self.meas[k]],
            "algos": algos, "new_events": events,
        }

    def result(self) -> dict:
        p = self.p
        algos = {n: r.result() for n, r in self.runs.items()}
        out = {
            "metadata": {
                "engine_version": ENGINE_VERSION, "seed": p.seed, "steps": p.steps,
                "time_step_s": p.time_step_s, "duration_s": p.duration_actual,
                "num_cells": p.num_cells, "coverage_radius_m": round(p.coverage_radius_m, 2),
                "cells": [{"id": i, "x_m": float(c[0]), "y_m": float(c[1])} for i, c in enumerate(self.cells)],
                "assumptions": ASSUMPTIONS, "simulated": True,
                "disclaimer": "Simulated results from a simplified model; not real-network measurements.",
            },
            "trajectory": {"time_s": [round(float(v), 3) for v in self.t],
                           "x_m": [round(float(v), 2) for v in self.x],
                           "y_m": [round(float(v), 2) for v in self.y]},
            "signal": {"true_dbm": [[round(float(v), 2) for v in self.true[:, c]] for c in range(p.num_cells)],
                       "measured_dbm": [[round(float(v), 2) for v in self.meas[:, c]] for c in range(p.num_cells)]},
            "algorithms": algos,
        }
        if "baseline" in algos and "proposed" in algos:
            out["comparison"] = compare_metrics(algos["baseline"]["metrics"], algos["proposed"]["metrics"])
        else:
            out["comparison"] = []
        return out


def run_simulation(p: SimParams) -> dict:
    sim = Simulation(p)
    while not sim.done:
        sim.step()
    return sim.result()
