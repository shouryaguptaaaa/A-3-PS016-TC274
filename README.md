**Hackathon:** AIORI-3  
**Problem Statement ID:** PS-016  
**Team Name:** Hackgen  
**Team ID:** A3-PS016-TC274  
**Team Leader:** Vaidik Upadhyay  
**Team Member:** Shourya Maheshwari  
**Mentor:** Mr. Abhay Gupta Sir

**Project Title:** Simulation-Based Handover Decision Evaluation for High-Mobility Users

## Problem Statement Explanation 
 [Watch Problem Statement Explanation](https://youtube.com/shorts/ua7QjNiv__w?si=yMCpECPtZuBSR8pY)

**Simulation-Based Handover Decision Evaluation for High-Mobility Users**
AIORI-3 Hackathon · Team **Hackgen** (ID `A3-PS016-TC274`) · Leader: Vaidik Upadhyay · Developer: Shourya Maheshwari · Mentor: Abhay Gupta

HandoverLab simulates a user moving through several cells and compares a **baseline** (strongest-cell) handover rule with a **proposed** rule (filtering + hysteresis + time-to-trigger). All results are **simulated** from a simplified model — not real-network measurements, and no superiority is assumed before experiments are run.

## Features
- Deterministic Python simulation engine (path loss, noise, hysteresis, TTT, execution delay, failures, ping-pong, outage/RLF), paired comparison with a shared seed
- FastAPI backend, SQLite persistence (PostgreSQL-ready via `DATABASE_URL`), CSV / JSON / PDF exports
- Live runs executed step by step on the backend with real progress, pause / resume / cancel
- React + Vite + TypeScript + Tailwind + Recharts dashboard (10 pages, responsive, phone friendly)
- Pytest and Vitest suites, Docker + Docker Compose, no paid services or API keys, works offline after install

## Architecture
```
frontend (React, Vite)  --/api-->  backend (FastAPI)
                                    ├─ api/routes.py        HTTP endpoints
                                    ├─ schemas/             Pydantic validation
                                    ├─ simulation/          engine, algorithms, metrics (pure NumPy)
                                    ├─ services/            db, exports, PDF, live jobs
                                    └─ models/ + core/      SQLAlchemy, settings
```

## Prerequisites
Python 3.11+ (3.12 tested), Node.js 20+ and npm, optionally Docker.

## Extract the ZIP
- Linux/macOS: `unzip handoverlab.zip && cd handoverlab`
- Windows: right-click the ZIP → *Extract All…*, then open a terminal in the `handoverlab` folder.

## Backend (terminal 1)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # Windows: copy .env.example .env
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs · health: http://localhost:8000/api/health

## Frontend (terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 (the dev server proxies `/api` to port 8000).

## Run a simulation
Open **New Simulation**, keep the defaults, press **Run simulation** (instant) or **Run live**. Then open **Results & Comparison**. Without the UI: `python scripts/run_sample_simulation.py` or `curl -X POST localhost:8000/api/simulations -H "Content-Type: application/json" -d '{}'`.

## Tests
```bash
cd backend  && pytest            # backend (engine, schemas, DB, API, exports)
cd frontend && npm test          # Vitest (forms, validation, results rendering)
cd frontend && npm run build     # type-check + production build
```

## Docker
```bash
docker compose up --build        # UI on http://localhost:8080, data kept in a volume
```

## Deployment guidance
Serve `frontend/dist` from any static host and run the backend with `uvicorn app.main:app --host 0.0.0.0` behind a reverse proxy that forwards `/api`. Set `CORS_ORIGINS` to the real front-end origin and `DATABASE_URL` to a persistent location (or PostgreSQL after adding a driver such as `psycopg`). The demo has no authentication; add it before exposing publicly. Live jobs are held in one process's memory, so run a single worker.

## Troubleshooting
- *"Cannot reach the backend"*: start uvicorn on port 8000; check **Settings → Test connection**.
- *CORS error with a custom API URL*: add the origin to `CORS_ORIGINS` in `backend/.env`.
- *PDF returns 501*: install `reportlab` and `matplotlib` (included in `requirements.txt`).
- *`pip` fails on numpy*: use Python 3.11–3.12 or relax the pin in `requirements.txt`.
- *Port in use*: change `--port` / `npm run dev -- --port 5174`.

## Docs
`docs/methodology.md`, `docs/api-guide.md`, `docs/experiment-guide.md`.
