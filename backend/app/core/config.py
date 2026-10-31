"""Runtime settings read from environment variables (see .env.example)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

try:  # optional: load backend/.env when python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:  # pragma: no cover
    pass


def _list(value: str) -> List[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./handoverlab.db"))
    cors_origins: List[str] = field(default_factory=lambda: _list(os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080")))
    max_sim_steps: int = field(default_factory=lambda: int(os.getenv("MAX_SIM_STEPS", "12000")))
    max_step_cells: int = field(default_factory=lambda: int(os.getenv("MAX_STEP_CELLS", "60000")))
    max_concurrent_jobs: int = field(default_factory=lambda: int(os.getenv("MAX_CONCURRENT_JOBS", "2")))
    max_step_delay_ms: int = field(default_factory=lambda: int(os.getenv("MAX_STEP_DELAY_MS", "2000")))
    app_name: str = "HandoverLab API"


settings = Settings()
