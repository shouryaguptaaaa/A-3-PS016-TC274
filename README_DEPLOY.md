# Deploy quick guide
Backend -> Render (Root Directory `backend`, Build `pip install -r requirements.txt`,
Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, env CORS_ORIGINS=<frontend URL>).
Frontend -> Vercel (Root Directory `frontend`); edit `frontend/vercel.json` and replace
YOUR-BACKEND-NAME with your Render service name.
Note: SQLite on Render free tier is wiped on redeploy/restart; use a persistent disk or PostgreSQL for permanent history.
