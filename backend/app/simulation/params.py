"""Plain, framework-independent simulation parameters.

The API layer validates user input with Pydantic and converts it into this
dataclass, so the engine can be used and tested without any web dependency.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Tuple

ENGINE_VERSION = "1.0.0"
ALGORITHM_NAMES = ("baseline", "proposed")


@dataclass(frozen=True)
class SimParams:
    scenario_name: str = "Corridor mobility test"
    num_cells: int = 3
    duration_s: float = 60.0
    speed_kmh: float = 60.0
    time_step_s: float = 0.5
    noise_std_db: float = 2.0
    hysteresis_db: float = 3.0
    ttt_s: float = 1.0
    exec_delay_s: float = 0.5
    min_signal_dbm: float = -110.0
    tx_power_dbm: float = -30.0
    path_loss_ref_db: float = 38.0
    path_loss_exponent: float = 3.2
    seed: int = 42
    algorithms: Tuple[str, ...] = ("baseline", "proposed")
    # Advanced / documented modelling parameters
    cell_spacing_m: float = 500.0
    cell_offset_m: float = 30.0
    reference_distance_m: float = 20.0
    filter_alpha: float = 0.5
    ping_pong_window_s: float = 5.0
    rlf_timer_s: float = 1.0
    reestablishment_delay_s: float = 1.0
    baseline_hysteresis_db: float = 0.0

    # ---- derived quantities -------------------------------------------------
    @property
    def steps(self) -> int:
        """Number of simulated intervals; samples are indexed 0..steps."""
        return max(1, int(round(self.duration_s / self.time_step_s)))

    @property
    def duration_actual(self) -> float:
        """Effective duration = steps * time_step (duration rounded to whole steps)."""
        return self.steps * self.time_step_s

    @property
    def speed_ms(self) -> float:
        return self.speed_kmh / 3.6

    @property
    def exec_steps(self) -> int:
        """Execution delay quantised UP to whole time steps."""
        return int(math.ceil(self.exec_delay_s / self.time_step_s - 1e-9))

    @property
    def rlf_steps(self) -> int:
        return max(1, int(math.ceil(self.rlf_timer_s / self.time_step_s - 1e-9)))

    @property
    def reest_steps(self) -> int:
        return max(1, int(math.ceil(self.reestablishment_delay_s / self.time_step_s - 1e-9)))

    @property
    def coverage_radius_m(self) -> float:
        """Distance at which the mean RSRP equals the minimum serving threshold."""
        exp = (self.tx_power_dbm - self.min_signal_dbm - self.path_loss_ref_db) / (
            10.0 * self.path_loss_exponent
        )
        return float(self.reference_distance_m * 10.0**exp)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["algorithms"] = list(self.algorithms)
        return d

    @classmethod
    def from_dict(cls, data: dict) -> "SimParams":
        known = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        if "algorithms" in known:
            known["algorithms"] = tuple(known["algorithms"])
        return cls(**known)
