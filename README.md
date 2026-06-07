# axiom-data-infrastructure

## Links

- **Live API:** [https://axiom-data-infrastructure.onrender.com](https://axiom-data-infrastructure.onrender.com)
- **API Docs:** [https://axiom-data-infrastructure.onrender.com/docs](https://axiom-data-infrastructure.onrender.com/docs)
- **Health Check:** [https://axiom-data-infrastructure.onrender.com/health](https://axiom-data-infrastructure.onrender.com/health)

## Verification

```bash
pytest backend/tests
npm test
npm run typecheck
python backend/scripts/smoke_test.py --base-url https://axiom-data-infrastructure.onrender.com
```

Generated run artifacts under `output/` and `local_artifacts/` are intentionally ignored by Git (see `.gitignore`).

## Portfolio Summary

ADI (Axiom Data Infrastructure) is an operator-assisted AI/Data Engineering system for cleaning and grading messy AEC operational data. It ingests ticket-style CSV and JSON records, applies a multi-agent repair workflow with deterministic guardrails, and returns scored, explainable results suitable for operator review and API integration.

**Technical highlights**

- FastAPI backend
- Pydantic validation
- JSON and CSV upload endpoints
- Analyzer / Transformer / Auditor workflow
- Self-correction retry loop
- `failed_records` dead-letter handling
- Deterministic final validation
- Health scoring
- Clean-vs-Dirty Summary Report (deterministic data grade, top issues, next steps)
- Structured logging
- TypeScript operator CLI
- Render deployment

## Architecture Overview

ADI (Axiom Data Infrastructure) is an operator-assisted AI/Data Engineering system for grading and cleaning messy AEC operational data. It combines a TypeScript operator CLI with a Python FastAPI backend so data can be ingested, repaired, validated, scored, and reviewed through both batch workflows and API calls.

### Major components

| Component | Location | Purpose |
|-----------|----------|---------|
| TypeScript operator CLI | `src/` | Reads CSV files, runs the LangGraph-style pipeline, writes JSON/Markdown reports, and supports operator overrides |
| Python FastAPI backend | `backend/` | Exposes grading APIs for JSON records and CSV upload |
| React demo frontend | `frontend/` | Lightweight grading demo with Run History over backend metadata and artifacts |
| Pydantic validation layer | `backend/core/schemas.py` | Strict request/response contracts and typed engine artifacts |
| Agent/state-machine engine | `backend/engine/`, `backend/agents/` | Analyzer, Transformer, and Auditor nodes orchestrated with explicit workflow state |
| Deterministic validation layer | `backend/engine/validation.py` | Final guardrail that enforces required AEC fields before success |
| Dead-letter handling | `failed_records` in API/CLI state | Captures unrecoverable rows with original raw data and failure reasons |
| Operator reporting and run history | `output/runs/`, `operator/` | Per-run reports, manifests, run index, and optional human decision overrides |

Both runtimes preserve raw input, record repairs and anomalies, compute an explainable health score, and surface row-level outcomes for operator review.

### State-machine flow

```text
Ingestion
  → Analyzer
  → Transformer
  → Auditor
  → Self-correction loop (max 2 retries)
  → Deterministic final validation
  → Response / report
```

**Ingestion** accepts CSV via the TypeScript CLI or JSON/CSV via the Python API (`POST /grade/aec`, `POST /grade/aec/upload`).

**Analyzer** detects missing or malformed fields and records anomalies.

**Transformer** applies deterministic repairs (date normalization, placeholder fills, quantity correction) with audit metadata.

**Auditor** checks cleaned output quality and routes failures back to Transformer with a `correction_instruction` when retries remain.

**Deterministic final validation** verifies exact AEC schema requirements before the run is marked successful.

**Response/report** returns structured API output or writes operator artifacts (`langgraph-report.json`, `clean-vs-dirty-report.md`, `manifest.json`, run index entries). Unrecoverable rows are dead-lettered into `failed_records`; when that list is not empty, `validation_passed` is `false`.

Structured logging records each node transition without emitting raw customer field values.

### Why this demonstrates AI/Data Engineering skills

- **Schema design** — Canonical AEC fields, profile-based column aliases, and Pydantic models for API and engine state
- **Data validation** — Input checks, agent-level auditing, and deterministic final validation before acceptance
- **Stateful workflows** — Explicit state (`raw_records`, `cleaned_records`, `repairs`, `anomalies`, `processing_history`, `retry_count`)
- **API design** — JSON and CSV ingestion paths sharing one grading engine
- **Observability** — Structured logs, processing history, health score explanations, and run metadata
- **Testing** — TypeScript and Python test suites covering clean, repairable, unrecoverable, retry, and upload paths
- **Failed-record handling** — Dead-letter queue for rows that cannot be safely repaired
- **Human-in-the-loop operations** — Operator overrides, review-flagged repairs, and Markdown reports for manual adjudication

### Portfolio Highlights

- Built a dual-runtime ADI platform: TypeScript operator CLI plus Python FastAPI backend on a shared AEC grading domain
- Implemented a multi-agent state machine (Analyzer → Transformer → Auditor) with bounded self-correction and deterministic final validation
- Designed strict Pydantic schemas and explainable health scoring for portfolio-ready API responses
- Added dead-letter handling for unrecoverable records while preserving valid rows in mixed batches
- Supported JSON and CSV ingestion through a single grading engine with structured logging and full test coverage
- Delivered operator-facing run history, manifests, and override workflows for human review of repaired data

## Experimental TypeScript LangGraph Engine

This branch includes an experimental multi-agent data cleaning pipeline built with LangGraph for TypeScript. It runs alongside the Python MVP and is intended for iteration—not production replacement yet.

**Branch:** `langgraph-typescript-engine`

### What it does

The engine:

- Reads a messy CSV file
- Preserves `rawData` exactly as ingested from the file
- Produces `cleanedData` with repaired values where possible
- Records `repairs` with an audit trail (original value, cleaned value, confidence, review flags)
- Records unresolved row-level `anomalies` for issues that could not be fixed
- Writes both JSON and Markdown reports

### Setup

```bash
npm install
```

### Run

Automatic output directory (`output/runs/<runId>/`):

```bash
npm run dev -- samples/dirty_aec_ticket.csv
npm run dev -- samples/dirty_aec_ticket.csv --profile aec
```

Explicit output directory:

```bash
npm run dev -- samples/dirty_aec_ticket.csv --output-dir output/runs/dirty-aec-test
npm run dev -- samples/dirty_aec_ticket.csv --profile aec --output-dir output/runs/dirty-aec-test
```

If no input path is provided, it defaults to `samples/dirty_aec_ticket.csv`.
If `--profile` is omitted, it defaults to `aec`.

When `--output-dir` is omitted, the engine creates a unique run folder under `output/runs/` using the same `runId` recorded in run metadata.

Reports are written to:

- `<output-dir>/langgraph-report.json`
- `<output-dir>/clean-vs-dirty-report.md`
- `<output-dir>/manifest.json` (run index metadata for operator traceability)

Each run is also appended to the central operator index at `output/runs/index.json` (deduplicated by `runId`).

The output directory is created automatically if it does not exist.

### Run history

List past operator grading runs:

```bash
npm run runs
```

### Typecheck

```bash
npm run typecheck
```

### Outputs

By default, each run writes to its own directory under `output/runs/<runId>/`:

| File | Description |
|------|-------------|
| `output/runs/<runId>/langgraph-report.json` | Full workflow state (raw data, cleaned data, repairs, anomalies, scores) |
| `output/runs/<runId>/clean-vs-dirty-report.md` | Human-readable summary with repairs and customer-facing anomalies |
| `output/runs/<runId>/manifest.json` | Run metadata (paths, health score, validation status, timestamps) |
| `output/runs/index.json` | Central index of all operator grading runs |

Use `--output-dir <path>` to write reports to a fixed directory instead (see **Run** above).

### Operator overrides

The engine reads optional manual decisions from `operator/decisions.json`. This file is **not** committed because it may contain customer or operator notes.

1. Copy the template:

```bash
cp operator/decisions.example.json operator/decisions.json
```

2. Edit `operator/decisions.json` with local row overrides (`row`, `finalDecision`, `operatorNote`).

Allowed `finalDecision` values: `approved`, `approved_with_changes`, `needs_customer_input`, `rejected`.

If `operator/decisions.json` is missing, the engine still runs and uses recommended decisions only.

## Operator Workflow

End-to-end steps for running ADI on AEC CSV data from a clean checkout.

### 1. Install dependencies

```bash
npm install
```

### 2. Run typecheck

```bash
npm run typecheck
```

### 3. Run tests

```bash
npm test
```

### 4. Run ADI (automatic output folder)

Creates a unique run folder under `output/runs/<runId>/`:

```bash
npm run dev -- samples/dirty_aec_ticket.csv --profile aec
```

### 5. Run ADI (explicit output folder)

Writes reports to a fixed directory you choose:

```bash
npm run dev -- samples/dirty_aec_ticket.csv --profile aec --output-dir output/runs/dirty-aec-test
```

### 6. View run history

```bash
npm run runs
```

### 7. Output locations

Each run writes:

- `output/runs/<runId>/langgraph-report.json` — full workflow state (raw data, cleaned data, repairs, anomalies, scores)
- `output/runs/<runId>/clean-vs-dirty-report.md` — human-readable summary for review
- `output/runs/<runId>/manifest.json` — run metadata (paths, health score, validation status, timestamps)

All runs are indexed at:

- `output/runs/index.json`

Generated files under `output/` are gitignored; see **Verification** above.

### 8. Operator overrides

For final human notes and decisions on specific rows:

```bash
cp operator/decisions.example.json operator/decisions.json
```

Edit `operator/decisions.json` with row-level overrides (`row`, `finalDecision`, `operatorNote`). This file is ignored by Git and may contain customer or operator notes.

If `operator/decisions.json` is missing, ADI still runs using recommended decisions only.

### 9. Row statuses

Each row is classified as one of:

| Status | Meaning |
|--------|---------|
| `clean` | No repairs needed |
| `repaired` | Automatically fixed with high confidence |
| `needs_review` | Repaired but flagged for operator review |
| `rejected` | Could not be cleaned to a valid state |

### 10. Final operator decisions

Recommended and final decisions use these values:

| Decision | Meaning |
|----------|---------|
| `approved` | Accept as-is |
| `approved_with_changes` | Accept after automatic repairs |
| `needs_customer_input` | Escalate to customer for missing or ambiguous data |
| `rejected` | Do not accept this row |

Override recommended decisions in `operator/decisions.json` when your judgment differs.

### 11. AEC column aliases

Source CSVs do not need exact canonical header names. The AEC profile maps common aliases to ADI fields via `profiles/aec.default.json` (e.g. `Ticket No` → `ticket_id`, `Pour Date` → `date`, `Site` → `job_site`).

If required canonical fields cannot be mapped, ADI fails before grading with a clear error.

## Python FastAPI Backend

A production-oriented Python backend lives under `backend/` and runs alongside the TypeScript engine. It exposes a JSON API for grading AEC ticket records with explainable, portfolio-ready output.

### Architecture

| Layer | Path | Role |
|-------|------|------|
| API | `backend/api/` | FastAPI app and routes (`GET /`, `GET /health`, `POST /grade/aec`, `POST /grade/aec/upload`) |
| Core | `backend/core/` | Pydantic schemas, config, structured logging |
| Engine | `backend/engine/` | State-machine orchestration, validation, scoring |
| Storage | `backend/storage/` | Pluggable artifact storage (`LocalStorageBackend` today; S3-ready interface) and local run metadata index |
| Agents | `backend/agents/` | Analyzer, Transformer, Auditor (isolated modules) |

The backend demonstrates:

- **Pydantic validation** — strict request/response contracts
- **State-machine processing** — explicit workflow state and `processing_history`
- **Self-correction loop** — Auditor/Validator failures route back to Transformer (max 2 retries)
- **Dead-letter handling** — unresolved records captured in `failed_records` with reasons
- **Deterministic final validation** — required AEC fields enforced before success
- **Structured logging** — JSON workflow transition logs (no raw customer values)

### Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## Environment Configuration

ADI uses a small set of environment variables for the Python backend. Copy the template for local development:

```bash
cp .env.example .env
```

Do **not** commit `.env` to Git. It is listed in `.gitignore` alongside `.envrc` for direnv users. Keep secrets and environment-specific values out of the repository.

Load variables into your shell before starting the API (example):

```bash
set -a && source .env && set +a
uvicorn backend.api.app:app --reload --port 8000
```

On Render, set the same keys in the service **Environment** settings instead of using a `.env` file.

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_ENV` | `development` | Deployment environment label (`development`, `staging`, `production`) |
| `LOG_LEVEL` | `INFO` | Structured log verbosity for the Python engine (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `ADI_ENGINE_VERSION` | `0.1.0` | Reported by `GET /health` and available for future release tagging |

These variables are intentionally lightweight today. The naming leaves room to add database URLs, API keys, and feature flags later without restructuring configuration.

Legacy note: `ADI_LOG_LEVEL` is still accepted as a fallback if `LOG_LEVEL` is unset.

### Run locally

```bash
uvicorn backend.api.app:app --reload --port 8000
```

### Frontend demo (Run History)

The `frontend/` app provides a lightweight grading demo with a **Run History** section that reads saved backend runs via:

- `GET /runs`
- `GET /runs/{run_id}/artifact`

Run metadata is stored locally in `local_artifacts/run_index.json` during MVP development. Result artifacts use the `StorageBackend` abstraction. Later, metadata can map to **DynamoDB** and artifacts to **S3** without changing the demo workflow.

```bash
cd frontend && npm install
cp .env.example .env
npm run dev
```

In another terminal, start the FastAPI backend on port 8000. The frontend defaults to `http://127.0.0.1:8000` (override with `VITE_API_BASE_URL`).

Grading responses and saved artifacts now include a deterministic **Clean-vs-Dirty Summary Report** with data grade, health score, clean vs flagged record counts, top issues, and recommended next steps. This is generated locally from validation results during MVP development (no LLM calls).

### Smoke test

Validate the three core API endpoints locally or against the deployed service (see **Verification**):

```bash
python backend/scripts/smoke_test.py --base-url http://127.0.0.1:8000
```

The script checks `GET /health`, `POST /grade/aec` with one repairable record, and `POST /grade/aec/upload` using `samples/dirty_aec_ticket.csv`. It prints `PASS`/`FAIL` for each check and exits with a non-zero status if any check fails. Response summaries include counts and scores only — not full customer record payloads.

### Endpoints

**`GET /`**

Friendly service index with links to the main API routes:

```bash
curl http://127.0.0.1:8000/
```

Returns:

```json
{
  "service": "adi-backend",
  "status": "ok",
  "health": "/health",
  "docs": "/docs",
  "json_endpoint": "/grade/aec",
  "csv_upload_endpoint": "/grade/aec/upload"
}
```

**`GET /health`**

Liveness check for deployments and local development:

```bash
curl http://127.0.0.1:8000/health
```

Returns `{"status": "ok", "service": "adi-backend", "version": "0.1.0"}`.

**`POST /grade/aec`**

Accepts a JSON body with a `records` array. Each record should include AEC fields: `ticket_id`, `date`, `customer`, `material`, `quantity`, `unit`, `job_site`.

Example request (repairable record with slash date and negative quantity):

```bash
curl -X POST "http://127.0.0.1:8000/grade/aec" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "ticket_id": "1002",
        "date": "05/02/26",
        "customer": "Acme Builders",
        "material": "Gravel",
        "quantity": -4,
        "unit": "tons",
        "job_site": "North Yard"
      }
    ]
  }'
```

Example response shape:

```json
{
  "cleaned_records": [
    {
      "ticket_id": "1002",
      "date": "2026-05-02",
      "customer": "Acme Builders",
      "material": "Gravel",
      "quantity": 4.0,
      "unit": "tons",
      "job_site": "North Yard"
    }
  ],
  "repairs": [
    {
      "row": 1,
      "field": "date",
      "original_value": "05/02/26",
      "cleaned_value": "2026-05-02",
      "action_taken": "Normalized date format to YYYY-MM-DD",
      "requires_review": false,
      "confidence": 0.95
    },
    {
      "row": 1,
      "field": "quantity",
      "original_value": "-4",
      "cleaned_value": "4",
      "action_taken": "Converted negative quantity to absolute value",
      "requires_review": true,
      "confidence": 0.75
    }
  ],
  "anomalies": [],
  "failed_records": [],
  "processing_history": [
    { "node": "analyzer", "status": "start", "message": "Running anomaly analysis", "retry_count": 0 },
    { "node": "analyzer", "status": "success", "message": "Analyzer detected 0 anomalies", "retry_count": 0 },
    { "node": "transformer", "status": "success", "message": "Transformer produced 1 active cleaned records", "retry_count": 0 },
    { "node": "auditor", "status": "success", "message": "Audit passed", "retry_count": 0 },
    { "node": "validator", "status": "success", "message": "Final validation passed", "retry_count": 0 },
    { "node": "complete", "status": "success", "message": "Workflow completed", "retry_count": 0 }
  ],
  "retry_count": 0,
  "health_score": 93.0,
  "health_score_explanation": {
    "starting_score": 100,
    "high_severity_anomaly_count": 0,
    "medium_severity_anomaly_count": 0,
    "review_required_repair_count": 1,
    "confident_repair_count": 1,
    "failed_record_count": 0,
    "final_score": 93.0
  },
  "validation_passed": true
}
```

Unrecoverable records follow the same shape but populate `failed_records`, set `validation_passed` to `false`, increment `retry_count`, and lower `health_score`. Validator `processing_history` entries use wording such as `Final validation failed due to dead-lettered records` rather than `Final validation passed` when dead-lettered rows are present.

### CSV upload endpoint

**`POST /grade/aec/upload`**

Accepts `multipart/form-data` with a single file field named `file`. The uploaded file must have a `.csv` extension, contain UTF-8 CSV data, and include a header row with AEC columns (`ticket_id`, `date`, `customer`, `material`, `quantity`, `unit`, `job_site`).

The upload route parses CSV rows and passes them to the same `run_aec_grading()` engine used by `POST /grade/aec`. No files are persisted.

Example request using the repository dirty sample:

```bash
curl -X POST "http://127.0.0.1:8000/grade/aec/upload" \
  -F "file=@samples/dirty_aec_ticket.csv"
```

For a dirty batch such as `samples/dirty_aec_ticket.csv`:

- Repairable rows (for example `05/02/26`, negative quantity) are normalized in `cleaned_records`
- Valid ISO dates such as `2026-05-01` and `2026-05-04` remain unchanged
- Unrecoverable rows (for example `bad-date`) are dead-lettered into `failed_records` after retry limits are exhausted
- The response sets `validation_passed` to `false` whenever `failed_records` is not empty
- `failed_records` preserves the original raw row plus a row-level failure reason

Upload validation errors return HTTP 400 with messages such as `File must be present`, `Filename must end with .csv`, or `File must not be empty`.

**`GET /runs`**

Read-only run history from the local backend metadata index (`local_artifacts/run_index.json`):

```bash
curl http://127.0.0.1:8000/runs
```

Returns `{"runs": [...]}` with metadata entries (`run_id`, `created_at`, `input_type`, `record_count`, `artifact_uri`, `health_score`, `validation_passed`, `failed_record_count`). When no index exists yet, returns `{"runs": []}`.

**`GET /runs/{run_id}`**

Fetch one run metadata entry by ID. Returns HTTP 404 with `{"detail": "Run not found"}` when the run is missing.

**`GET /runs/{run_id}/artifact`**

Read-only retrieval of the saved grading result JSON for a prior run:

```bash
curl http://127.0.0.1:8000/runs/<run_id>/artifact
```

Returns the stored result artifact (same shape as `POST /grade/aec`). Returns HTTP 404 when the run is missing and HTTP 410 with `{"detail": "Run artifact not found"}` when metadata exists but the artifact file is unavailable.

During MVP development, run metadata lives in `local_artifacts/run_index.json` and result artifacts are stored locally through the `StorageBackend` abstraction. Later, metadata can map to **DynamoDB** and artifacts to **S3** without changing the API workflow.

## Render Deployment

The Python FastAPI backend is deployed at the **Live API** link above and can also be redeployed on [Render](https://render.com) using the root `render.yaml` blueprint.

### Blueprint

`render.yaml` defines a Python web service that:

- Installs dependencies with `pip install -r backend/requirements.txt`
- Starts with `uvicorn backend.api.app:app --host 0.0.0.0 --port $PORT`
- Uses `/health` for Render health checks

### Deploy steps

1. Push this repository to GitHub.
2. In the Render Dashboard, connect your GitHub account and select this repository.
3. Create a **Blueprint** (or new **Web Service**) from `render.yaml` at the repo root.
4. Wait for the deploy to finish, then verify the service index and health check:

```bash
curl https://axiom-data-infrastructure.onrender.com/
curl https://axiom-data-infrastructure.onrender.com/health
```

Expected response:

```json
{"status": "ok", "service": "adi-backend", "version": "0.1.0"}
```

5. Test JSON grading:

```bash
curl -X POST "https://axiom-data-infrastructure.onrender.com/grade/aec" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"ticket_id":"1002","date":"05/02/26","customer":"Acme","material":"Gravel","quantity":-4,"unit":"tons","job_site":"North Yard"}]}'
```

6. Test CSV upload:

```bash
curl -X POST "https://axiom-data-infrastructure.onrender.com/grade/aec/upload" \
  -F "file=@samples/dirty_aec_ticket.csv"
```

The TypeScript operator CLI is not deployed by this blueprint; run it locally or deploy it separately if needed.

### Note

This TypeScript engine is currently on the **`langgraph-typescript-engine`** branch and should **not** replace the Python MVP yet. The Python validator in `app/validator.py` remains the baseline for comparison.

## AWS Data Engineering Roadmap

ADI is deployed on Render today. This section outlines a practical AWS-native evolution path aligned with Data Engineer Associate patterns. **Nothing below is implemented yet**—it is a roadmap for how the current design could map to AWS services without changing the core grading logic.

Run artifacts are already abstracted behind `backend/storage/` (`StorageBackend` with `LocalStorageBackend` writing to `local_artifacts/`). A future `S3StorageBackend` can implement the same interface without changing grading logic. Backend run metadata is appended to `local_artifacts/run_index.json` today, exposed through read-only `GET /runs`, `GET /runs/{run_id}`, and `GET /runs/{run_id}/artifact`, and is designed to map to **DynamoDB** later without changing the product workflow.

### Current deployment

- Render-hosted FastAPI backend ([Live API](https://axiom-data-infrastructure.onrender.com))
- JSON grading via `POST /grade/aec` and CSV upload via `POST /grade/aec/upload`
- Local and deployed verification via `pytest backend/tests`, `npm test`, and `backend/scripts/smoke_test.py`

### Future AWS architecture mapping

| ADI concept today | Planned AWS service | Role |
|-------------------|---------------------|------|
| CSV upload payloads | **S3** | Store raw uploads and cleaned output artifacts (via future `S3StorageBackend`) |
| Public HTTP API | **API Gateway** or **Application Load Balancer** | Route client requests to compute |
| Grading engine execution | **Lambda** or **ECS/Fargate** | Run validation, cleaning, and scoring workloads |
| `failed_records` dead letters | **SQS** dead-letter queue | Capture unrecoverable rows for replay or operator review |
| Run metadata and health scores | **DynamoDB** | Persist run IDs, timestamps, scores, and status (via `run_index.json` locally today) |
| Structured logging | **CloudWatch** Logs, metrics, and alarms | Operational visibility and alerting |
| Canonical AEC schema (later) | **Glue Data Catalog** | Track schema versions and dataset lineage |
| Analyzer → Transformer → Auditor flow (later) | **Step Functions** | Orchestrate the state machine with explicit retries and branching |

### Workflow mapping

The current **Analyzer → Transformer → Auditor** pipeline with a bounded self-correction loop maps naturally to **Step Functions** or event-driven orchestration: each agent becomes a state (or Lambda task), retry routing becomes a conditional transition, and deterministic final validation becomes a terminal guard step before success.

### Dead-letter mapping

Today, unrecoverable rows land in `failed_records` with the original raw row and a failure reason. On AWS, that pattern maps cleanly to an **SQS DLQ** for async replay and alerting, or to an **S3 failed-record prefix** (for example `s3://bucket/failed/`) for durable batch inspection—mirroring the API’s dead-letter behavior without rewriting the grading rules.

### Certification alignment

This roadmap supports hands-on study for the **AWS Certified Data Engineer – Associate** exam: ingestion (S3), API front doors (API Gateway/ALB), compute (Lambda/ECS), messaging (SQS), operational data stores (DynamoDB), observability (CloudWatch), cataloging (Glue), and orchestration (Step Functions)—while keeping ADI’s existing Pydantic contracts and agent boundaries intact during a future migration.
