# ADI Deployment Smoke Test

Phase 7 readiness guide for verifying the deployed MVP before external demos.

## Latest deployed smoke test result

**Status:** Passed — manual end-to-end verification (Phase 7)

| Target | URL |
|--------|-----|
| Deployed frontend | Configured Render frontend URL |
| Deployed backend | [Live API](https://axiom-data-infrastructure.onrender.com) (see README) |

Verified:

- GitHub Actions CI passing on `main`
- Deployed frontend loads
- Deployed backend health/status is reachable
- Frontend **Backend Status** shows **Backend connected**
- Frontend uses the deployed backend API base URL (not localhost)
- `samples/aec_messy_sample.csv` uploads successfully
- **Clean-vs-Dirty Summary Report** appears (`records_flagged` > 0, top issues, recommended next steps)
- Run appears in **Run History**
- Saved artifact opens from **View Result**
- Raw JSON preview remains available

**Storage caveat still applies:** MVP persistence is local filesystem based (`local_artifacts/`). On Render or other ephemeral hosts, run history and artifacts may reset after redeploy or restart. This is acceptable for the current MVP demo. Future production mapping: **S3** for artifacts, **DynamoDB** for run metadata (not implemented).

Re-run the [checklist below](#deployed-end-to-end-smoke-verification-checklist) before future external demos.

## Deployed end-to-end smoke verification checklist

Use this checklist before an external demo. Check items in order.

### Pre-demo gates

- [ ] **GitHub Actions CI is passing on `main`** — open the repo **Actions** tab and confirm the latest `CI` workflow succeeded (backend tests + frontend tests + typecheck).
- [ ] **Deployed backend health responds** — `GET /health` returns `status: ok` (see [curl checks](#optional-curl-checks) below).
- [ ] **Deployed frontend loads** — open the demo UI (local Vite dev server or deployed static host).
- [ ] **Frontend Backend Status shows connected** — top of page reads **Backend connected (adi-backend v…)**.
- [ ] **Frontend uses the deployed backend URL, not localhost** — **Backend Status** shows `API base URL: https://your-backend-service.example.com` (not `http://127.0.0.1:8000` or `http://localhost:8000`).

### Messy sample upload flow

- [ ] Upload **`samples/aec_messy_sample.csv`** through the frontend.
- [ ] **Clean-vs-Dirty Summary Report** appears after upload.
- [ ] **`records_flagged` is greater than zero** for the messy sample.
- [ ] **Top issues** are listed (for example missing fields, invalid dates, or bad quantities).
- [ ] **Recommended next steps** are listed.
- [ ] A new **run appears in Run History**.
- [ ] **Saved artifact opens** from **View Result** in Run History.
- [ ] **Raw JSON preview** remains available below the summary.

### Repo hygiene and storage expectations

- [ ] **`local_artifacts/` is not committed to git** — confirm `git status` is clean and `.gitignore` excludes `local_artifacts/`.
- [ ] **Local-first deployed storage caveat is understood** — see [Known MVP deployment caveats](#known-mvp-deployment-caveats) below.

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

## Environment variable verification

The frontend reads **`VITE_API_BASE_URL`** at build/dev time (`frontend/src/api/config.ts`). All API calls use `buildApiUrl()` so trailing slashes on the base URL do not break paths.

| Environment | `VITE_API_BASE_URL` |
|-------------|---------------------|
| **Local backend** | `http://127.0.0.1:8000` or `http://localhost:8000` |
| **Deployed backend** | `https://your-backend-service.example.com` |

Example local `frontend/.env`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Example deployed `frontend/.env` (local frontend pointed at production API):

```bash
VITE_API_BASE_URL=https://your-backend-service.example.com
```

Verification steps:

1. Open `frontend/.env` (copy from `frontend/.env.example` if needed).
2. Confirm the value matches the backend you intend to demo against.
3. Restart the Vite dev server after any change (`cd frontend && npm run dev`).
4. Confirm **Backend Status** shows the same base URL and **Backend connected**.

For a deployed static frontend, set `VITE_API_BASE_URL` at **build time** (not runtime). Rebuild after changing it.

No secrets are required for MVP demo configuration.

### Frontend backend health indicator

On load, the demo UI calls `GET /health` and shows **Backend Status** at the top of the page:

- **Checking backend connection...** — health request in progress
- **Backend connected (adi-backend v0.1.0).** — API base URL and `/health` are reachable
- **Backend unreachable. Check API base URL configuration.** — wrong URL, backend down, or CORS blocking the browser

### CORS

The backend allows `http://127.0.0.1:5173` and `http://localhost:5173` by default. For other frontend origins, set `ADI_CORS_ORIGINS` on the backend service.

## Known MVP deployment caveats

- **Current MVP persistence is local filesystem based.** Artifacts are stored under `local_artifacts/runs/<run_id>/result.json` via `StorageBackend`. Run metadata lives in `local_artifacts/run_index.json`.
- **On Render or other ephemeral platforms, `local_artifacts/` may reset after redeploys, restarts, or instance rotation.** Run History may appear empty on a fresh instance. Artifact retrieval may return **410** if metadata outlives the file.
- **This is acceptable for the current MVP demo.** Grading, summary generation, and immediate API responses still work for demo verification.
- **Future production path (not implemented in this repo):**
  - **S3** for artifacts (via a future `S3StorageBackend`)
  - **DynamoDB** for run metadata

No AWS dependencies are required for this verification step.

## Manual failure checks (local development only)

Intentionally verify guardrails before a demo. **Do not commit bad configuration.**

1. Edit `frontend/.env` and set a bad URL, for example:
   ```bash
   VITE_API_BASE_URL=https://invalid-backend.example.com
   ```
2. Restart Vite: `cd frontend && npm run dev`
3. Reload the demo UI and confirm:
   - **Backend Status** shows **Backend unreachable. Check API base URL configuration.**
   - Upload/grade actions show **Could not reach the ADI backend. Check the API base URL and backend deployment.**
4. Restore the correct value in `frontend/.env` and restart Vite.
5. Confirm **Backend connected** returns before the demo.

Keep `frontend/.env` out of git (it is listed in `.gitignore`).

## Optional curl checks

Replace the placeholder with your deployed backend URL:

```bash
export API=https://your-backend-service.example.com
```

**Health and index:**

```bash
curl "$API/health"
curl "$API/"
```

Expected health response shape: `{"status":"ok","service":"adi-backend","version":"0.1.0"}` (version may vary).

**Run history:**

```bash
curl "$API/runs"
```

**JSON grading** (minimal repairable AEC record):

```bash
curl -X POST "$API/grade/aec" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"ticket_id":"1002","date":"05/02/26","customer":"Acme","material":"Gravel","quantity":-4,"unit":"tons","job_site":"North Yard"}]}'
```

Confirm the response includes a `summary` object with `data_grade`, `records_flagged`, `top_issues`, and `recommended_next_steps`.

**CSV upload:**

```bash
curl -X POST "$API/grade/aec/upload" \
  -F "file=@samples/aec_messy_sample.csv"
```

## Automated backend smoke test

From the repo root (with venv activated and dependencies installed):

```bash
python scripts/smoke_backend.py --base-url https://your-backend-service.example.com
```

Environment variable fallback:

```bash
export ADI_API_BASE_URL=https://your-backend-service.example.com
python scripts/smoke_backend.py
```

Optional messy demo CSV:

```bash
python scripts/smoke_backend.py \
  --base-url https://your-backend-service.example.com \
  --csv-path samples/aec_messy_sample.csv
```

Checks performed:

1. `GET /health`
2. `POST /grade/aec` (repairable JSON record + summary)
3. `POST /grade/aec/upload` (sample CSV)
4. `GET /runs` (returns a list, may be empty on fresh deploy)

Exit code `0` = all checks passed.

## Full MVP demo walkthrough (local frontend)

1. Set `VITE_API_BASE_URL` to local or deployed backend (see [Environment variable verification](#environment-variable-verification)).
2. Start backend locally if needed: `uvicorn backend.api.app:app --reload --port 8000`
3. Start frontend: `cd frontend && npm run dev`
4. Open `http://127.0.0.1:5173`
5. Confirm **Backend Status** shows **Backend connected**
6. Upload `samples/aec_messy_sample.csv`
7. Verify **Clean-vs-Dirty Summary Report**, **Run History**, and **View Result** (summary + raw JSON)
8. Optionally upload `samples/aec_clean_sample.csv` for comparison

## Misconfigured API base URL (symptoms)

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

## Phase 7 quick reference

| Step | Command / action |
|------|------------------|
| CI status | GitHub **Actions** → latest `CI` workflow on `main` |
| Backend smoke | `python scripts/smoke_backend.py --base-url <deployed-api>` |
| Health | `curl <deployed-api>/health` |
| Frontend | `cd frontend && npm run dev` → confirm **Backend connected** |
| E2E demo | Upload `samples/aec_messy_sample.csv` → summary + run history + artifact |
