"""Pydantic request/response schemas with strict validation."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..core.config import settings
from ..simulation.params import SimParams

_BAD = re.compile(r"[\x00-\x1f\x7f<>]")
F = dict(allow_inf_nan=False)


class SimulationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_name: str = Field("Corridor mobility test", min_length=1, max_length=100)
    num_cells: int = Field(3, ge=2, le=10)
    duration_s: float = Field(60.0, ge=5, le=600, **F)
    speed_kmh: float = Field(60.0, gt=0, le=350, **F)
    time_step_s: float = Field(0.5, ge=0.05, le=5, **F)
    noise_std_db: float = Field(2.0, ge=0, le=10, **F)
    hysteresis_db: float = Field(3.0, ge=0, le=15, **F)
    ttt_s: float = Field(1.0, ge=0, le=10, **F)
    exec_delay_s: float = Field(0.5, ge=0, le=5, **F)
    min_signal_dbm: float = Field(-110.0, ge=-140, le=-60, **F)
    tx_power_dbm: float = Field(-30.0, ge=-60, le=50, **F)
    path_loss_ref_db: float = Field(38.0, ge=0, le=120, **F)
    path_loss_exponent: float = Field(3.2, ge=1.5, le=6, **F)
    seed: int = Field(42, ge=0, le=2**31 - 1)
    algorithms: List[Literal["baseline", "proposed"]] = Field(default_factory=lambda: ["baseline", "proposed"])
    # advanced
    cell_spacing_m: float = Field(500.0, ge=100, le=5000, **F)
    cell_offset_m: float = Field(30.0, ge=5, le=500, **F)
    reference_distance_m: float = Field(20.0, ge=1, le=100, **F)
    filter_alpha: float = Field(0.5, ge=0.05, le=1, **F)
    ping_pong_window_s: float = Field(5.0, ge=0.5, le=60, **F)
    rlf_timer_s: float = Field(1.0, ge=0, le=10, **F)
    reestablishment_delay_s: float = Field(1.0, ge=0, le=10, **F)
    baseline_hysteresis_db: float = Field(0.0, ge=0, le=15, **F)

    @field_validator("scenario_name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("scenario_name must not be blank")
        if _BAD.search(v):
            raise ValueError("scenario_name contains control characters or '<' '>'")
        return v

    @field_validator("algorithms")
    @classmethod
    def _algos(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("select at least one algorithm")
        if len(set(v)) != len(v):
            raise ValueError("algorithms must be unique")
        return v

    @model_validator(mode="after")
    def _limits(self) -> "SimulationConfig":
        steps = int(round(self.duration_s / self.time_step_s))
        if steps > settings.max_sim_steps:
            raise ValueError(f"duration/time_step gives {steps} steps; maximum is {settings.max_sim_steps}")
        if steps * self.num_cells > settings.max_step_cells:
            raise ValueError(
                f"steps x cells = {steps * self.num_cells} exceeds the limit {settings.max_step_cells}")
        if self.time_step_s > self.duration_s:
            raise ValueError("time_step_s must not exceed duration_s")
        return self

    def to_params(self) -> SimParams:
        data = self.model_dump()
        data["algorithms"] = tuple(data["algorithms"])
        return SimParams(**data)


class JobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    config: SimulationConfig
    step_delay_ms: int = Field(150, ge=0, le=2000)


class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    experiment_ids: List[int] = Field(..., min_length=2, max_length=6)

    @field_validator("experiment_ids")
    @classmethod
    def _unique(cls, v: List[int]) -> List[int]:
        if len(set(v)) != len(v):
            raise ValueError("experiment_ids must be unique")
        return v


class ExperimentSummary(BaseModel):
    id: int
    scenario_name: str
    created_at: str
    status: str
    speed_kmh: float
    num_cells: int
    duration_s: float
    seed: int
    algorithms: List[str]
    metrics: Dict[str, Any]


class ExperimentList(BaseModel):
    total: int
    items: List[ExperimentSummary]


class ExperimentDetail(ExperimentSummary):
    config: Dict[str, Any]
    result: Dict[str, Any]
