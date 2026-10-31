"""HTTP routes. Simulation work is executed in the backend only."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..schemas.simulation import (CompareRequest, ExperimentDetail, ExperimentList, JobRequest,
                                  SimulationConfig)
from ..services import db_service, export_service
from ..services.jobs import TooManyJobs, manager
from ..simulation.engine import run_simulation
from ..simulation.metrics import METRIC_DEFINITIONS

router = APIRouter(prefix="/api")


@router.get("/health", tags=["system"])
def health():
    return {"status": "ok", "service": "handoverlab-api"}


@router.get("/definitions", tags=["system"])
def definitions():
    """Metric definitions (units, denominators, edge cases)."""
    return METRIC_DEFINITIONS


@router.get("/defaults", tags=["system"])
def defaults():
    """Default simulation configuration."""
    return SimulationConfig().model_dump()


@router.get("/stats/overview", tags=["experiments"])
def overview(db: Session = Depends(get_db)):
    return db_service.overview_stats(db)


@router.post("/simulations", response_model=ExperimentDetail, status_code=status.HTTP_201_CREATED,
             tags=["experiments"])
def create_simulation(config: SimulationConfig, db: Session = Depends(get_db)):
    """Run a complete simulation synchronously in the backend and persist it."""
    result = run_simulation(config.to_params())
    exp = db_service.create_experiment(db, config.model_dump(), result)
    return db_service.to_detail(exp)


@router.get("/simulations", response_model=ExperimentList, tags=["experiments"])
def list_simulations(search: Optional[str] = Query(None, max_length=100),
                     limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                     db: Session = Depends(get_db)):
    total, rows = db_service.list_experiments(db, search, limit, offset)
    return {"total": total, "items": [db_service.to_summary(r) for r in rows]}


@router.post("/simulations/compare", tags=["experiments"])
def compare_experiments(req: CompareRequest, db: Session = Depends(get_db)):
    """Side-by-side metrics of several SAVED experiments (nothing is re-simulated)."""
    items = []
    for i in req.experiment_ids:
        exp = db_service.get_experiment(db, i)
        if exp is None:
            raise HTTPException(status_code=404, detail=f"Experiment {i} not found")
        items.append(db_service.to_summary(exp))
    return {"experiments": items}


def _get_or_404(db: Session, exp_id: int):
    exp = db_service.get_experiment(db, exp_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


@router.get("/simulations/{exp_id}", response_model=ExperimentDetail, tags=["experiments"])
def get_simulation(exp_id: int, db: Session = Depends(get_db)):
    return db_service.to_detail(_get_or_404(db, exp_id))


@router.delete("/simulations/{exp_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["experiments"])
def delete_simulation(exp_id: int, db: Session = Depends(get_db)):
    if not db_service.delete_experiment(db, exp_id):
        raise HTTPException(status_code=404, detail="Experiment not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _attachment(content: str, media: str, filename: str) -> Response:
    return Response(content=content, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/simulations/{exp_id}/export/csv", tags=["export"])
def export_csv(exp_id: int, kind: str = Query("timeseries", pattern="^(timeseries|events|metrics)$"),
               db: Session = Depends(get_db)):
    exp = _get_or_404(db, exp_id)
    body = export_service.csv_for_kind(exp.result_json, kind)
    return _attachment(body, "text/csv; charset=utf-8", f"handoverlab_{exp_id}_{kind}.csv")


@router.get("/simulations/{exp_id}/export/json", tags=["export"])
def export_json(exp_id: int, db: Session = Depends(get_db)):
    exp = _get_or_404(db, exp_id)
    body = export_service.experiment_json(db_service.to_detail(exp))
    return _attachment(body, "application/json", f"handoverlab_{exp_id}.json")


@router.get("/simulations/{exp_id}/report/pdf", tags=["export"])
def report_pdf(exp_id: int, db: Session = Depends(get_db)):
    exp = _get_or_404(db, exp_id)
    try:
        from ..services.report_service import build_pdf

        pdf = build_pdf(db_service.to_detail(exp))
    except ImportError:
        raise HTTPException(status_code=501, detail="PDF support needs reportlab and matplotlib installed")
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="handoverlab_{exp_id}.pdf"'})


# ---- live jobs ----------------------------------------------------------------
@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED, tags=["live"])
def start_job(req: JobRequest):
    try:
        job = manager.create(req.config.model_dump(), req.config.to_params(), req.step_delay_ms)
    except TooManyJobs:
        raise HTTPException(status_code=429, detail="Too many simulations running; try again shortly")
    return {"id": job.id, "status": job.status}


def _job_or_404(job_id: str):
    job = manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}", tags=["live"])
def job_status(job_id: str, since: int = Query(0, ge=0)):
    return _job_or_404(job_id).snapshot(since)


@router.post("/jobs/{job_id}/pause", tags=["live"])
def job_pause(job_id: str):
    job = _job_or_404(job_id); job.pause(); return job.snapshot(10**9)


@router.post("/jobs/{job_id}/resume", tags=["live"])
def job_resume(job_id: str):
    job = _job_or_404(job_id); job.resume(); return job.snapshot(10**9)


@router.post("/jobs/{job_id}/cancel", tags=["live"])
def job_cancel(job_id: str):
    job = _job_or_404(job_id); job.cancel(); return job.snapshot(10**9)
