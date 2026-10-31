"""Background step-by-step simulation jobs (for the Live Simulation screen).

The engine really advances one step at a time inside a worker thread. An optional
per-step delay (`step_delay_ms`) paces the run so progress can be watched; the
progress fraction is exactly step/total_steps of the real computation.
Pause/resume/cancel are honoured between steps. Completed runs are persisted;
cancelled or failed runs are not.
"""
from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from ..core.config import settings
from ..core.database import SessionLocal
from ..simulation.engine import Simulation
from ..simulation.params import SimParams
from . import db_service

log = logging.getLogger("handoverlab.jobs")


class TooManyJobs(Exception):
    pass


class Job:
    def __init__(self, cfg: dict, params: SimParams, step_delay_s: float):
        self.id = uuid.uuid4().hex[:12]
        self.cfg, self.params, self.delay = cfg, params, step_delay_s
        self.status = "running"
        self.samples: List[dict] = []
        self.events: List[dict] = []
        self.error: Optional[str] = None
        self.experiment_id: Optional[int] = None
        self.created = time.time()
        self._run_flag = threading.Event()
        self._run_flag.set()
        self._cancel = threading.Event()
        self.lock = threading.Lock()
        self.sim: Optional[Simulation] = None
        self.total_steps = params.steps + 1  # samples 0..steps

    def run(self) -> None:
        try:
            self.sim = Simulation(self.params)
            while not self.sim.done:
                self._run_flag.wait()
                if self._cancel.is_set():
                    with self.lock:
                        self.status = "cancelled"
                    return
                s = self.sim.step()
                with self.lock:
                    self.events.extend(s["new_events"])
                    self.samples.append(s)
                if self.delay:
                    end = time.time() + self.delay
                    while time.time() < end and not self._cancel.is_set():
                        time.sleep(min(0.02, max(0.0, end - time.time())))
            result = self.sim.result()
            db = SessionLocal()
            try:
                exp = db_service.create_experiment(db, self.cfg, result)
                with self.lock:
                    self.experiment_id = exp.id
                    self.status = "completed"
            finally:
                db.close()
        except Exception:  # never leak internals to the client
            log.exception("simulation job %s failed", self.id)
            with self.lock:
                self.status, self.error = "failed", "The simulation failed due to an internal error."

    def snapshot(self, since: int) -> Dict[str, Any]:
        with self.lock:
            done = len(self.samples)
            status = "paused" if (self.status == "running" and not self._run_flag.is_set()) else self.status
            return {
                "id": self.id, "status": status, "scenario_name": self.cfg["scenario_name"],
                "progress": {"step": done, "total_steps": self.total_steps,
                             "fraction": done / self.total_steps},
                "samples": self.samples[max(0, since):], "events": list(self.events),
                "experiment_id": self.experiment_id, "error": self.error,
                "cells": [{"id": i, "x_m": i * self.params.cell_spacing_m, "y_m": self.params.cell_offset_m}
                          for i in range(self.params.num_cells)],
                "coverage_radius_m": round(self.params.coverage_radius_m, 2),
                "algorithms": list(self.params.algorithms), "min_signal_dbm": self.params.min_signal_dbm,
            }

    def pause(self) -> None:
        if self.status == "running":
            self._run_flag.clear()

    def resume(self) -> None:
        self._run_flag.set()

    def cancel(self) -> None:
        self._cancel.set()
        self._run_flag.set()


class JobManager:
    def __init__(self, max_keep: int = 20):
        self._jobs: "OrderedDict[str, Job]" = OrderedDict()
        self._lock = threading.Lock()
        self.max_keep = max_keep

    def _active(self) -> int:
        return sum(1 for j in self._jobs.values() if j.status == "running")

    def create(self, cfg: dict, params: SimParams, step_delay_ms: int) -> Job:
        delay = min(step_delay_ms, settings.max_step_delay_ms) / 1000.0
        with self._lock:
            if self._active() >= settings.max_concurrent_jobs:
                raise TooManyJobs()
            job = Job(cfg, params, delay)
            self._jobs[job.id] = job
            while len(self._jobs) > self.max_keep:
                oldest = next(iter(self._jobs))
                if self._jobs[oldest].status == "running":
                    break
                self._jobs.pop(oldest)
        threading.Thread(target=job.run, daemon=True, name=f"sim-{job.id}").start()
        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)


manager = JobManager()
