"""Database access functions (all queries use SQLAlchemy's parameter binding)."""
from __future__ import annotations

from datetime import timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..models.db_models import Experiment


def create_experiment(db: Session, config: dict, result: dict) -> Experiment:
    summary = {name: a["metrics"] for name, a in result["algorithms"].items()}
    exp = Experiment(
        scenario_name=config["scenario_name"], status="completed",
        speed_kmh=config["speed_kmh"], num_cells=config["num_cells"],
        duration_s=result["metadata"]["duration_s"], seed=config["seed"],
        algorithms=",".join(config["algorithms"]),
        config_json=config, summary_json=summary, result_json=result,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


def get_experiment(db: Session, exp_id: int) -> Optional[Experiment]:
    return db.get(Experiment, exp_id)


def delete_experiment(db: Session, exp_id: int) -> bool:
    exp = db.get(Experiment, exp_id)
    if exp is None:
        return False
    db.delete(exp)
    db.commit()
    return True


def _escape_like(s: str) -> str:
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_experiments(db: Session, search: Optional[str], limit: int, offset: int) -> Tuple[int, List[Experiment]]:
    stmt = select(Experiment)
    count = select(func.count()).select_from(Experiment)
    if search:
        s = search.strip()[:100]
        cond = Experiment.scenario_name.ilike(f"%{_escape_like(s)}%", escape="\\")
        if s.isdigit() and len(s) <= 9:
            cond = or_(cond, Experiment.id == int(s))
        stmt, count = stmt.where(cond), count.where(cond)
    total = db.execute(count).scalar_one()
    rows = db.execute(stmt.order_by(Experiment.created_at.desc(), Experiment.id.desc())
                      .limit(limit).offset(offset)).scalars().all()
    return total, list(rows)


def iso(dt) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def to_summary(exp: Experiment) -> Dict[str, Any]:
    return {
        "id": exp.id, "scenario_name": exp.scenario_name, "created_at": iso(exp.created_at),
        "status": exp.status, "speed_kmh": exp.speed_kmh, "num_cells": exp.num_cells,
        "duration_s": exp.duration_s, "seed": exp.seed,
        "algorithms": exp.algorithms.split(","), "metrics": exp.summary_json,
    }


def to_detail(exp: Experiment) -> Dict[str, Any]:
    d = to_summary(exp)
    d["config"] = exp.config_json
    d["result"] = exp.result_json
    return d


def overview_stats(db: Session) -> Dict[str, Any]:
    """Aggregate real metrics from saved experiments. Empty store -> total 0, no numbers."""
    rows = db.execute(select(Experiment).order_by(Experiment.created_at.desc(), Experiment.id.desc())).scalars().all()
    out: Dict[str, Any] = {"total_experiments": len(rows), "total_handover_events": 0,
                           "avg_handover_delay_s": None, "failure_rate": None,
                           "ping_pong_rate": None, "avg_handover_count": None,
                           "by_algorithm": {}, "recent": [to_summary(r) for r in rows[:5]]}
    if not rows:
        return out
    acc: Dict[str, Dict[str, float]] = {}
    for r in rows:
        for name, m in r.summary_json.items():
            a = acc.setdefault(name, {"runs": 0, "attempts": 0, "success": 0, "failed": 0, "pp": 0,
                                      "outage": 0.0, "delay_sum": 0.0, "delay_n": 0, "interrupt": 0.0})
            a["runs"] += 1
            a["attempts"] += m["handover_attempts"]
            a["success"] += m["handover_count"]
            a["failed"] += m["handover_failures"]
            a["pp"] += m["ping_pong_events"]
            a["outage"] += m["outage_duration_s"]
            a["interrupt"] += m["interruption_s"]
            tot = m["total_delay_s"]
            if tot["n"]:
                a["delay_sum"] += tot["mean"] * tot["n"]
                a["delay_n"] += tot["n"]
    T = {"attempts": 0, "success": 0, "failed": 0, "pp": 0, "delay_sum": 0.0, "delay_n": 0, "runs": 0}
    for name, a in acc.items():
        out["by_algorithm"][name] = {
            "runs": a["runs"], "handover_attempts": a["attempts"], "handover_count": a["success"],
            "avg_handover_count": a["success"] / a["runs"],
            "failure_rate": a["failed"] / a["attempts"] if a["attempts"] else None,
            "ping_pong_rate": a["pp"] / a["success"] if a["success"] else None,
            "avg_outage_s": a["outage"] / a["runs"], "avg_interruption_s": a["interrupt"] / a["runs"],
            "avg_total_delay_s": a["delay_sum"] / a["delay_n"] if a["delay_n"] else None,
        }
        for k in T:
            T[k] += a[k]
    out["total_handover_events"] = T["attempts"]
    out["failure_rate"] = T["failed"] / T["attempts"] if T["attempts"] else None
    out["ping_pong_rate"] = T["pp"] / T["success"] if T["success"] else None
    out["avg_handover_delay_s"] = T["delay_sum"] / T["delay_n"] if T["delay_n"] else None
    out["avg_handover_count"] = T["success"] / T["runs"] if T["runs"] else None
    return out
