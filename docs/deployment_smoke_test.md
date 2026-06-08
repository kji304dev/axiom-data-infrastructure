# ADI Deployment Smoke Test

Phase 7 readiness guide for verifying the deployed MVP before external demos.

## Current deployment layout

| Component | Status | Notes |
|-----------|--------|-------|
| **Backend (FastAPI)** | Deployed on Render | [https://axiom-data-infrastructure.onrender.com](https://axiom-data-infrastructure.onrender.com) |
| **Frontend (Vite/React)** | Local or separate static host | Not defined in `render.yaml` today |
| **Storage** | Local-first (`local_artifacts/`) | Ephemeral on Render — see caveats below |

### Backend (Render)

From `render.yaml`:

- **Build:** `pip install -r backend/requirements.txt`
- **Start:** `uvicorn backend.api.app:app --host 0.0.0.0 --port $PORT`
- **Health check:** `GET /health`

Optional environment variables (Render dashboard):

| Variable | Purpose |
|----------|---------|
| `APP_ENV` | Environment label (`development`, `staging`, `production`) |
| `LOG_LEVEL` | Log verbosity |
| `ADI_ENGINE_VERSION` | Reported by `/health` |
| `ADI_CORS_ORIGINS` | Comma-separated extra CORS origins for a deployed/local frontend (e.g. `http://localhost:5173,https://your-frontend.onrender.com`) |

### Frontend API base URL

The frontend reads **`VITE_API_BASE_URL`** at build/dev time (`frontend/src/api/config.ts`).

| Environment | Setting |
|-------------|---------|
| **Local dev (default)** | `VITE_API_BASE_URL=http://127.0.0.1:8000` in `frontend/.env` |
| **Local frontend → deployed backend** | `VITE_API_BASE_URL=https://axiom-data-infrastructure.onrender.com` |
| **Deployed frontend (future)** | Set `VITE_API_BASE_URL` to the Render backend URL at build time |

Restart the Vite dev server after changing `.env`.

### CORS

The backend allows `http://127.0.0.1:5173` and `http://localhost:5173` by default. For other frontend origins, set `ADI_CORS_ORIGINS` on the backend service.

## Automated backend smoke test

From the repo root (with venv activated and dependencies installed):

```bash
python backend/scripts/smoke_test.py --base-url https://axiom-data-infrastructure.onrender.com
```

Or use the root wrapper:

```bash
python scripts/smoke_backend.py --base-url https://axiom-data-infrastructure.onrender.com
```

Environment variable fallback:

```bash
export ADI_API_BASE_URL=https://axiom-data-infrastructure.onrender.com
python scripts/smoke_backend.py
```

Optional messy demo CSV:

```bash
python scripts/smoke_backend.py \
  --base-url https://axiom-data-infrastructure.onrender.com \
  --csv-path samples/aec_messy_sample.csv
```

Checks performed:

1. `GET /health`
2. `POST /grade/aec` (repairable JSON record + summary)
3. `POST /grade/aec/upload` (sample CSV)
4. `GET /runs` (returns a list, may be empty on fresh deploy)

Exit code `0` = all checks passed.

## Manual smoke test checklist

### Backend only (curl)

```bash
export API=https://axiom-data-infrastructure.onrender.com

curl "$API/health"
curl "$API/"

curl -X POST "$API/grade/aec" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"ticket_id":"1002","date":"05/02/26","customer":"Acme","material":"Gravel","quantity":-4,"unit":"tons","job_site":"North Yard"}]}'

curl -X POST "$API/grade/aec/upload" \
  -F "file=@samples/aec_messy_sample.csv"

curl "$API/runs"
```

Confirm the JSON grading response includes a `summary` object with `data_grade`, `records_flagged`, `top_issues`, and `recommended_next_steps`.

### Full MVP demo (local frontend + backend)

1. Start backend locally or point frontend at deployed API (see `VITE_API_BASE_URL` above).
2. Start frontend: `cd frontend && npm run dev`
3. Open `http://127.0.0.1:5173`
4. Upload `samples/aec_messy_sample.csv`
5. Verify **Clean-vs-Dirty Summary Report** appears
6. Confirm run appears in **Run History**
7. Click **View Result** — summary first, then raw JSON
8. Upload `samples/aec_clean_sample.csv` for comparison

### Misconfigured API base URL

If `VITE_API_BASE_URL` is wrong:

- Upload/grade buttons show an error alert
- Run History shows **Unable to load run history**
- Browser devtools network tab shows failed requests (CORS or connection errors)

Fix `frontend/.env` and restart Vite.

## Local-first storage caveat (MVP)

The current MVP persists:

- **Artifacts** under `local_artifacts/runs/<run_id>/result.json` via `StorageBackend`
- **Run metadata** in `local_artifacts/run_index.json`

On **ephemeral platforms** (e.g. Render free tier):

- Files may **not survive redeploys, restarts, or instance rotation**
- `GET /runs` may return `{"runs": []}` on a fresh instance even after successful grading in the same session if storage was cleared
- `GET /runs/{run_id}/artifact` may return **410** if metadata exists but the artifact file was lost

This is **acceptable for MVP demo and API verification**. Grading, summary generation, and immediate responses still work.

### Future production mapping (not implemented)

| MVP today | Future |
|-----------|--------|
| `local_artifacts/` artifacts | **S3** via `S3StorageBackend` |
| `run_index.json` metadata | **DynamoDB** |

No AWS dependencies are required for this smoke-test step.

## Phase 7 demo readiness checklist

- [ ] `python scripts/smoke_backend.py --base-url <deployed-api>` passes
- [ ] `GET /health` returns `status: ok`
- [ ] JSON grading returns `summary`
- [ ] CSV upload with `aec_messy_sample.csv` returns flagged records
- [ ] Frontend loads with correct `VITE_API_BASE_URL`
- [ ] CORS allows your frontend origin (if not localhost)
- [ ] Clean-vs-Dirty Summary visible after upload
- [ ] Run History loads (may be empty after redeploy on ephemeral storage)
- [ ] Understand artifact/history limits on ephemeral deploys
