# Experiment guide

1. Open **New Simulation**; defaults match the PS-016 example (3 cells, 60 s, 60 km/h, 0.5 s step, 2 dB noise, 3 dB hysteresis, 1 s TTT, 0.5 s execution delay, -110 dBm, -30 dBm, 38 dB, 3.2, seed 42).
2. **Run simulation** for an instant result or **Run live** to watch the backend step through the run (pause/resume/cancel supported).
3. Open **Results & Comparison**. Winners are computed from real outputs; "Change vs baseline" is `(proposed - baseline) / baseline`.
4. Vary one parameter at a time (speed, noise, TTT, hysteresis) and several seeds; compare saved runs.
5. Export CSV/JSON/PDF from **Export Reports**.

Interpretation tip: lower is better for every compared metric, but TTT intentionally increases decision delay; a trade-off is expected.
