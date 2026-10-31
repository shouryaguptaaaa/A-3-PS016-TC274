# HandoverLab methodology (PS-016)

> HandoverLab is a **simplified simulation model**. It is not a validated real-world radio-network predictor and makes no claim of 6G compliance, certification, real-network integration or proven superiority.

## Model
- Cells on a line at `x_i = i * spacing`, lateral offset `cell_offset_m`; UE moves at constant speed along y = 0 starting at x = 0.
- Path loss: `PL(d) = PL_ref + 10 n log10(max(d, d0)/d0)`; `RSRP = P_tx - PL`. `d0` = `reference_distance_m` (default 20 m). Flat below d0.
- Measurement = true RSRP + N(0, sigma^2) noise. No shadowing/fading/interference/load.
- Time is discretised: samples k = 0..steps, `steps = round(duration/dt)`. Execution delay, RLF timer and re-establishment delay are rounded **up** to whole steps.

## Algorithms
**Baseline (strongest cell):** handover when best neighbour measured RSRP > serving measured RSRP + `baseline_hysteresis_db` (default 0). No TTT, no filtering.

**Proposed (hysteresis + TTT + filtering):** EMA filter `F[k] = a*M[k] + (1-a)*F[k-1]`; trigger when best neighbour `F` > serving `F` + hysteresis for the *same* neighbour continuously for TTT; urgent bypass if serving `F` < minimum threshold. This is a candidate that must be evaluated, not assumed better.

## Outcome rules
Success iff true source RSRP at execution start >= threshold **and** true target RSRP at completion >= threshold. Failure => radio-link failure => re-establishment outage (`reestablishment_delay_s`) then re-selection of the strongest measured cell. RLF is also declared when serving true RSRP stays below the threshold for `rlf_timer_s`.

## Metrics (denominators and edge cases)
| Metric | Definition |
|---|---|
| handover_attempts | completed executions (success + failure); an execution unfinished at the end is not counted |
| handover_count | successful handovers |
| failure_rate | failures / attempts; null if 0 attempts |
| ping_pong_events | successful A->B handovers returning B->A within `ping_pong_window_s` (completion to completion) |
| ping_pong_rate | ping-pong events / successful handovers; null if 0 |
| outage_duration_s | time without usable link (below threshold until recovery + re-establishment) |
| interruption_s | time spent executing handovers (not outage) |
| rlf_count | sustained-low-signal or failed-handover RLFs |
| decision_delay_s | execution start - first time trigger condition held (0 for baseline) |
| execution_delay_s | completion - start (configured delay rounded up) |

## Procedure and reproducibility
Trajectory, true RSRP and one noise matrix (from `numpy.random.default_rng(seed)`) are generated once and shared by all algorithms (paired design). Same configuration + seed => identical results. One seed is one sample: repeat with several seeds before drawing conclusions.

## Limitations
Single straight corridor; constant speed; regular spacing; no interference/load/fading; deterministic threshold rules; time quantisation; results apply to the simulated scenario only.
