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

### Note

This TypeScript engine is currently on the **`langgraph-typescript-engine`** branch and should **not** replace the Python MVP yet. The Python validator in `app/validator.py` remains the baseline for comparison.
