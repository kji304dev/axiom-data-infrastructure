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

The frontend reads **`VITE_API_BASE_URL`** at build/dev time (`frontend/src/api/config.ts`). All API calls go through `buildApiUrl()` so trailing slashes on the base URL do not break endpoint paths.

| Environment | Setting |
|-------------|---------|
| **Local dev (default)** | `VITE_API_BASE_URL=http://127.0.0.1:8000` in `frontend/.env` |
| **Local frontend → deployed backend** | `VITE_API_BASE_URL=https://your-backend.onrender.com` |
| **Deployed frontend (future)** | Set `VITE_API_BASE_URL` to the Render backend URL at build time |

Example local value:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Example deployed value placeholder:

```bash
VITE_API_BASE_URL=https://your-adi-backend.onrender.com
```

Restart the Vite dev server after changing `.env`.

### Frontend backend health indicator

On load, the demo UI calls `GET /health` and shows **Backend Status** at the top of the page:

- **Checking backend connection...** — health request in progress
- **Backend connected (adi-backend v0.1.0).** — API base URL and `/health` are reachable
- **Backend unreachable. Check API base URL configuration.** — wrong URL, backend down, or CORS blocking the browser

Verify backend health manually:

```bash
curl "$VITE_API_BASE_URL/health"
# or
curl https://your-adi-backend.onrender.com/health
```

Expected: `{"status":"ok","service":"adi-backend","version":"0.1.0"}` (version may vary).

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

- **Backend Status** shows **Backend unreachable. Check API base URL configuration.**
- Upload/grade actions show **Could not reach the ADI backend. Check the API base URL and backend deployment.**
- Run History shows the same reachability message (or an HTTP/CORS message if the server responds with an error status)
- Browser devtools network tab shows failed requests (connection refused, CORS, or 404)

What to check:

1. `frontend/.env` has the correct `VITE_API_BASE_URL` (no trailing slash required)
2. Vite dev server was restarted after editing `.env`
3. Backend is running (`curl <base-url>/health`)
4. `ADI_CORS_ORIGINS` on the backend includes your frontend origin if not localhost

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
- [ ] Frontend **Backend Status** shows **Backend connected**
- [ ] CORS allows your frontend origin (if not localhost)
- [ ] Clean-vs-Dirty Summary visible after upload
- [ ] Run History loads (may be empty after redeploy on ephemeral storage)
- [ ] Understand artifact/history limits on ephemeral deploys
