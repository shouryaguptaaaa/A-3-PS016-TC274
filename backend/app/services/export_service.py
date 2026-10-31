"""CSV / JSON exports built from SAVED experiment data only (no recomputation)."""
from __future__ import annotations

import csv
import io
import json
from typing import Any, Dict, List

import pandas as pd

_DANGEROUS = ("=", "+", "-", "@", "\t", "\r")


def _safe(value: Any) -> Any:
    """Neutralise spreadsheet-formula injection in text cells."""
    if isinstance(value, str) and value.startswith(_DANGEROUS):
        return "'" + value
    return value


def _write(rows: List[List[Any]]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    for r in rows:
        w.writerow([_safe(c) for c in r])
    return buf.getvalue()


def timeseries_frame(result: Dict[str, Any]) -> pd.DataFrame:
    """Per-step table (trajectory, true/measured RSRP per cell, serving cell + state per algorithm)."""
    n_cells = result["metadata"]["num_cells"]
    traj, sig = result["trajectory"], result["signal"]
    data: Dict[str, Any] = {"time_s": traj["time_s"], "x_m": traj["x_m"], "y_m": traj["y_m"]}
    for c in range(n_cells):
        data[f"rsrp_true_cell{c}_dbm"] = sig["true_dbm"][c]
    for c in range(n_cells):
        data[f"rsrp_measured_cell{c}_dbm"] = sig["measured_dbm"][c]
    for a, res in result["algorithms"].items():
        data[f"{a}_serving_cell"] = res["serving_cell"]
        data[f"{a}_state"] = res["state"]
    return pd.DataFrame(data)


def timeseries_csv(result: Dict[str, Any]) -> str:
    return timeseries_frame(result).to_csv(index=False, lineterminator="\n")


EVENT_COLUMNS = ["algorithm", "event_id", "type", "trigger_time_s", "completion_time_s", "source_cell",
                 "target_cell", "success", "failure_reason", "ping_pong", "decision_delay_s",
                 "execution_delay_s", "source_rsrp_dbm", "target_rsrp_dbm", "time_s", "cause", "cell"]


def events_csv(result: Dict[str, Any]) -> str:
    rows: List[List[Any]] = [EVENT_COLUMNS]
    for a, data in result["algorithms"].items():
        for e in data["events"]:
            row = []
            for col in EVENT_COLUMNS:
                if col == "event_id":
                    row.append(e.get("id"))
                else:
                    v = e.get(col, "")
                    row.append("" if v is None else v)
            rows.append(row)
    return _write(rows)


def metrics_csv(result: Dict[str, Any]) -> str:
    algos = list(result["algorithms"].keys())
    flat: Dict[str, Dict[str, Any]] = {}
    for a in algos:
        for k, v in result["algorithms"][a]["metrics"].items():
            if isinstance(v, dict):
                for kk, vv in v.items():
                    flat.setdefault(f"{k}.{kk}", {})[a] = vv
            else:
                flat.setdefault(k, {})[a] = v
    rows: List[List[Any]] = [["metric"] + algos]
    for k, vals in flat.items():
        rows.append([k] + ["" if vals.get(a) is None else vals.get(a) for a in algos])
    return _write(rows)


def experiment_json(detail: Dict[str, Any]) -> str:
    return json.dumps(detail, indent=2, ensure_ascii=False)


def csv_for_kind(result: Dict[str, Any], kind: str) -> str:
    if kind == "timeseries":
        return timeseries_csv(result)
    if kind == "events":
        return events_csv(result)
    if kind == "metrics":
        return metrics_csv(result)
    raise ValueError("kind must be one of: timeseries, events, metrics")
