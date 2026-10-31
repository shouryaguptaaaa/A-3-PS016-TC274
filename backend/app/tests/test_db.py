from app.core.database import SessionLocal
from app.schemas.simulation import SimulationConfig
from app.services import db_service
from app.simulation.engine import run_simulation


def _make(db, **kw):
    cfg = SimulationConfig(**kw)
    return db_service.create_experiment(db, cfg.model_dump(), run_simulation(cfg.to_params()))


def test_experiment_is_persisted_and_readable_from_new_session(db):
    exp = _make(db, scenario_name="Persist me")
    other = SessionLocal()  # a fresh session simulates an application restart
    try:
        got = db_service.get_experiment(other, exp.id)
        assert got is not None and got.scenario_name == "Persist me"
        assert got.result_json["algorithms"]["baseline"]["metrics"]["handover_count"] >= 0
        assert got.created_at is not None
    finally:
        other.close()


def test_list_search_and_pagination(db):
    for n in ("Alpha run", "Beta run", "Alpha two"):
        _make(db, scenario_name=n, duration_s=10)
    total, rows = db_service.list_experiments(db, None, 50, 0)
    assert total == 3 and rows[0].scenario_name == "Alpha two"  # newest first
    total, rows = db_service.list_experiments(db, "alpha", 50, 0)
    assert total == 2
    total, rows = db_service.list_experiments(db, None, 1, 1)
    assert total == 3 and len(rows) == 1


def test_search_treats_wildcards_literally(db):
    _make(db, scenario_name="A%B", duration_s=10)
    _make(db, scenario_name="AxB", duration_s=10)
    total, _ = db_service.list_experiments(db, "A%B", 50, 0)
    assert total == 1


def test_delete(db):
    exp = _make(db, duration_s=10)
    assert db_service.delete_experiment(db, exp.id) is True
    assert db_service.get_experiment(db, exp.id) is None
    assert db_service.delete_experiment(db, exp.id) is False


def test_overview_empty_has_no_invented_numbers(db):
    s = db_service.overview_stats(db)
    assert s["total_experiments"] == 0 and s["failure_rate"] is None and s["by_algorithm"] == {}


def test_overview_aggregates_real_results(db):
    e1 = _make(db, duration_s=20)
    e2 = _make(db, duration_s=20, seed=5)
    s = db_service.overview_stats(db)
    expected = sum(m["handover_attempts"] for e in (e1, e2) for m in e.summary_json.values())
    assert s["total_experiments"] == 2 and s["total_handover_events"] == expected
    assert set(s["by_algorithm"]) == {"baseline", "proposed"}
