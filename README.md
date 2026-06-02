# axiom-data-infrastructure

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

Do **not** commit generated output files. They are local run artifacts.

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

### Note

This TypeScript engine is currently on the **`langgraph-typescript-engine`** branch and should **not** replace the Python MVP yet. The Python validator in `app/validator.py` remains the baseline for comparison.
