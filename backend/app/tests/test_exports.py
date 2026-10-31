import csv
import io
import json

from app.services import export_service as ex
from app.simulation.engine import run_simulation
from app.simulation.params import SimParams


def _result():
    return run_simulation(SimParams(duration_s=10.0, noise_std_db=4.0))


def test_timeseries_csv_shape():
    res = _result()
    rows = list(csv.reader(io.StringIO(ex.timeseries_csv(res))))
    assert len(rows) == len(res["trajectory"]["time_s"]) + 1
    assert rows[0][:3] == ["time_s", "x_m", "y_m"] and "baseline_serving_cell" in rows[0]
    assert all(len(r) == len(rows[0]) for r in rows)


def test_events_csv_contains_all_events():
    res = _result()
    rows = list(csv.DictReader(io.StringIO(ex.events_csv(res))))
    expected = sum(len(a["events"]) for a in res["algorithms"].values())
    assert len(rows) == expected


def test_metrics_csv_columns():
    rows = list(csv.reader(io.StringIO(ex.metrics_csv(_result()))))
    assert rows[0] == ["metric", "baseline", "proposed"]
    assert any(r[0] == "handover_count" for r in rows)


def test_csv_formula_injection_neutralised():
    assert ex._safe("=SUM(A1)") == "'=SUM(A1)"
    assert ex._safe("normal") == "normal" and ex._safe(5) == 5


def test_json_export_roundtrip():
    detail = {"id": 1, "result": _result()}
    assert json.loads(ex.experiment_json(detail))["id"] == 1


def test_unknown_csv_kind_rejected():
    try:
        ex.csv_for_kind(_result(), "nope")
    except ValueError:
        return
    raise AssertionError("expected ValueError")
