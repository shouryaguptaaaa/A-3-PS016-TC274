"""Metric definitions and calculations.

All metrics are computed from the event log and per-step state counters of ONE
algorithm run. Denominators and edge cases are explicit:

handover_attempts   completed handover executions (success + failure). A
                    handover still executing when the simulation ends is not
                    counted.
handover_count      successful handovers (serving-cell changes caused by HO).
handover_failures   attempts that failed (see engine for the failure rules).
failure_rate        failures / attempts            [unitless 0..1]; null if 0 attempts.
ping_pong_events    successful handovers A->B that return to the previous cell
                    (B->A) within `ping_pong_window_s` of the previous handover
                    completion (completion-to-completion).
ping_pong_rate      ping_pong_events / handover_count  [0..1]; null if 0 handovers.
outage_duration_s   total time the UE had no usable serving link: time with the
                    serving cell's TRUE RSRP below the minimum threshold (until
                    RLF is declared and re-establishment completes) plus the
                    re-establishment period. Seconds.
interruption_s      total time spent in handover execution (data interruption
                    while a handover is being executed). Seconds. Not outage.
rlf_count           radio-link failures (sustained sub-threshold signal or
                    failed handover); each triggers re-establishment.
decision_delay      (execution start - first time the trigger condition held)
                    per attempt. Seconds. 0 for the baseline by construction.
execution_delay     (execution completion - execution start) per attempt;
                    equals the configured delay rounded UP to a whole step.
total_delay         decision_delay + execution_delay per attempt.
outage_ratio        outage_duration_s / duration_s.
"""
from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np

METRIC_DEFINITIONS: Dict[str, Dict[str, str]] = {
    "handover_count": {"label": "Successful handovers", "unit": "count",
        "definition": "Serving-cell changes caused by completed, successful handovers."},
    "handover_attempts": {"label": "Handover attempts", "unit": "count",
        "definition": "Completed handover executions (successes + failures)."},
    "failure_rate": {"label": "Handover failure rate", "unit": "ratio",
        "definition": "failed attempts / attempts. Not defined (n/a) when there were no attempts."},
    "ping_pong_events": {"label": "Ping-pong events", "unit": "count",
        "definition": "Successful handovers that return to the previous cell within the ping-pong window."},
    "ping_pong_rate": {"label": "Ping-pong rate", "unit": "ratio",
        "definition": "ping-pong events / successful handovers. n/a when there were no successful handovers."},
    "outage_duration_s": {"label": "Outage duration", "unit": "s",
        "definition": "Time without a usable serving link (sub-threshold signal until recovery, plus re-establishment)."},
    "interruption_s": {"label": "Handover interruption", "unit": "s",
        "definition": "Total time spent executing handovers (service interruption)."},
    "rlf_count": {"label": "Radio-link failures", "unit": "count",
        "definition": "Sustained sub-threshold signal or failed handover, each followed by re-establishment."},
    "mean_decision_delay_s": {"label": "Mean decision delay", "unit": "s",
        "definition": "Mean time between the trigger condition first holding and execution starting."},
}

# metrics compared between baseline and proposed (lower is better for all)
COMPARED = [
    "handover_count", "ping_pong_events", "ping_pong_rate", "failure_rate",
    "outage_duration_s", "interruption_s", "rlf_count", "mean_decision_delay_s",
]


def delay_stats(values: List[float]) -> Dict[str, Optional[float]]:
    if not values:
        return {"n": 0, "mean": None, "median": None, "min": None, "max": None, "std": None}
    a = np.asarray(values, dtype=float)
    return {"n": int(a.size), "mean": float(a.mean()), "median": float(np.median(a)),
            "min": float(a.min()), "max": float(a.max()), "std": float(a.std())}


def compute_algorithm_metrics(events: List[dict], counters: dict, duration_s: float) -> dict:
    ho = [e for e in events if e["type"] == "handover"]
    ok = [e for e in ho if e["success"]]
    failed = [e for e in ho if not e["success"]]
    pp = [e for e in ok if e.get("ping_pong")]
    rlf = [e for e in events if e["type"] == "rlf"]
    attempts = len(ho)
    exec_d = [e["execution_delay_s"] for e in ho]
    dec_d = [e["decision_delay_s"] for e in ho]
    tot_d = [a + b for a, b in zip(exec_d, dec_d)]
    n_ok = len(ok)
    connected = counters["connected_steps"]
    mean_rsrp = counters["rsrp_sum"] / connected if connected else None
    return {
        "handover_attempts": attempts,
        "handover_count": n_ok,
        "handover_failures": len(failed),
        "failure_rate": (len(failed) / attempts) if attempts else None,
        "ping_pong_events": len(pp),
        "ping_pong_rate": (len(pp) / n_ok) if n_ok else None,
        "outage_duration_s": counters["outage_steps"] * counters["dt"],
        "outage_ratio": (counters["outage_steps"] * counters["dt"] / duration_s) if duration_s else None,
        "interruption_s": counters["handover_steps"] * counters["dt"],
        "rlf_count": len(rlf),
        "handovers_per_minute": (n_ok / duration_s * 60.0) if duration_s else None,
        "mean_serving_rsrp_dbm": mean_rsrp,
        "execution_delay_s": delay_stats(exec_d),
        "decision_delay_s": delay_stats(dec_d),
        "total_delay_s": delay_stats(tot_d),
        "mean_decision_delay_s": delay_stats(dec_d)["mean"],
    }


_MECHANISM = {
    "handover_count": (
        "Hysteresis, time-to-trigger and measurement filtering suppress handovers caused by short noise-induced signal crossings.",
        "In this run the proposed strategy did not reduce the number of handovers (for example the urgent-bypass rule or few noise crossings).",
    ),
    "ping_pong_events": (
        "The proposed rule needs a sustained, filtered margin before switching, which makes quick A->B->A returns less likely.",
        "The proposed rule produced at least as many quick returns as the baseline in this run.",
    ),
    "ping_pong_rate": (
        "A smaller share of the proposed strategy's handovers were quick returns to the previous cell.",
        "A larger share of the proposed strategy's handovers were quick returns in this run.",
    ),
    "failure_rate": (
        "Fewer handovers were started towards cells that were too weak when execution completed.",
        "A larger share of the proposed strategy's attempts failed, e.g. because waiting for TTT delayed execution until the source cell was too weak.",
    ),
    "outage_duration_s": (
        "Less time was spent below the minimum threshold or re-establishing the link.",
        "More time was spent without a usable link, e.g. because TTT/filtering delayed switching at high speed or noise.",
    ),
    "interruption_s": (
        "Fewer executions means less cumulative interruption time.",
        "The proposed strategy spent more total time executing handovers.",
    ),
    "rlf_count": (
        "Fewer radio-link failures occurred.",
        "More radio-link failures occurred, which can happen when decisions are delayed.",
    ),
    "mean_decision_delay_s": (
        "Decisions were taken sooner after the trigger condition first held.",
        "Time-to-trigger and filtering deliberately delay execution, so a higher decision delay is expected.",
    ),
}


def compare_metrics(base: dict, prop: dict) -> List[dict]:
    rows = []
    for key in COMPARED:
        meta = METRIC_DEFINITIONS[key]
        b, p = base.get(key), prop.get(key)
        if b is None or p is None:
            winner, delta, rel = "n/a", None, None
            text = "Not defined for at least one algorithm (no handovers/attempts to divide by)."
        else:
            delta = p - b
            rel = (b - p) / b * 100.0 if b > 0 else None
            if abs(delta) < 1e-12:
                winner = "tie"
                text = "Both algorithms produced the same value in this scenario."
            elif delta < 0:
                winner, text = "proposed", _MECHANISM[key][0]
            else:
                winner, text = "baseline", _MECHANISM[key][1]
        rows.append({
            "metric": key, "label": meta["label"], "unit": meta["unit"],
            "baseline": b, "proposed": p, "delta": delta,
            "relative_improvement_pct": rel, "winner": winner,
            "explanation": text + " (Simulated finding for this scenario and seed only.)",
        })
    return rows
