"""ORM models. JSON columns keep the schema portable between SQLite and PostgreSQL."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scenario_name: Mapped[str] = mapped_column(String(100), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    status: Mapped[str] = mapped_column(String(20), default="completed")
    speed_kmh: Mapped[float] = mapped_column(Float)
    num_cells: Mapped[int] = mapped_column(Integer)
    duration_s: Mapped[float] = mapped_column(Float)
    seed: Mapped[int] = mapped_column(Integer)
    algorithms: Mapped[str] = mapped_column(String(100))  # comma separated
    config_json: Mapped[dict] = mapped_column(JSON)
    summary_json: Mapped[dict] = mapped_column(JSON)  # per-algorithm metrics (small)
    result_json: Mapped[dict] = mapped_column(JSON)  # full time series + events
