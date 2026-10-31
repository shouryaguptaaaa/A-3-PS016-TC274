"""Offline smoke test: run the default scenario for both algorithms and print metrics.

Usage (from the project root):  python scripts/run_sample_simulation.py
Needs only numpy (the engine has no web/database dependency).
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "backend"))

from app.simulation.engine import run_simulation  # noqa: E402
from app.simulation.params import SimParams  # noqa: E402

result = run_simulation(SimParams())
for name, data in result["algorithms"].items():
    m = data["metrics"]
    print(f"{name:9s} handovers={m['handover_count']} failures={m['handover_failures']} "
          f"ping_pong={m['ping_pong_events']} outage_s={m['outage_duration_s']:.2f} "
          f"interruption_s={m['interruption_s']:.2f}")
print("\nComparison (simulated, this seed only):")
for row in result["comparison"]:
    print(f"  {row['label']:26s} baseline={row['baseline']} proposed={row['proposed']} -> {row['winner']}")
print(f"\nResult size: {len(json.dumps(result)) / 1024:.1f} KiB")
