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

Default output directory (`output/`):

```bash
npm run dev -- samples/dirty_aec_ticket.csv
```

Custom output directory:

```bash
npm run dev -- samples/dirty_aec_ticket.csv --output-dir output/runs/dirty-aec-test
```

If no input path is provided, it defaults to `samples/dirty_aec_ticket.csv`.

Reports are written to:

- `<output-dir>/langgraph-report.json`
- `<output-dir>/clean-vs-dirty-report.md`

The output directory is created automatically if it does not exist.

### Typecheck

```bash
npm run typecheck
```

### Outputs

By default, reports are written to `output/`:

| File | Description |
|------|-------------|
| `output/langgraph-report.json` | Full workflow state (raw data, cleaned data, repairs, anomalies, scores) |
| `output/clean-vs-dirty-report.md` | Human-readable summary with repairs and customer-facing anomalies |

Use `--output-dir <path>` to write reports to a different directory (see **Run** above).

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
