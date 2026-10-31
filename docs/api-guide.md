# API guide

Interactive docs: `http://localhost:8000/docs` (Swagger UI) and `/redoc`.

| Method | Path | Notes |
|---|---|---|
| GET | /api/health | liveness |
| GET | /api/defaults, /api/definitions | default config; metric definitions |
| GET | /api/stats/overview | aggregates from saved runs (empty store => totals 0, null rates) |
| POST | /api/simulations | run synchronously + save; 201; 422 on invalid config |
| GET | /api/simulations?search=&limit=&offset= | history list |
| GET | /api/simulations/{id} | full detail; 404 if missing |
| DELETE | /api/simulations/{id} | 204 / 404 |
| POST | /api/simulations/compare | body `{"experiment_ids":[1,2]}` (2-6) from saved data |
| GET | /api/simulations/{id}/export/csv?kind=timeseries\|events\|metrics | CSV download |
| GET | /api/simulations/{id}/export/json | JSON download |
| GET | /api/simulations/{id}/report/pdf | PDF report (needs reportlab + matplotlib) |
| POST | /api/jobs | body `{"config":{...},"step_delay_ms":150}`; 202; 429 if too many running |
| GET | /api/jobs/{id}?since=N | status, real progress, samples from index N, events |
| POST | /api/jobs/{id}/pause, /resume, /cancel | live controls |

Example:
```bash
curl -X POST http://localhost:8000/api/simulations -H "Content-Type: application/json" -d '{}'
```
Limits (env): `MAX_SIM_STEPS` (12000), `MAX_STEP_CELLS` (60000), `MAX_CONCURRENT_JOBS` (2). Cancelled/failed live runs are not saved.
