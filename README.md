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

```bash
npm run dev -- samples/dirty_aec_ticket.csv
```

If no file path is provided, it defaults to `samples/dirty_aec_ticket.csv`.

### Typecheck

```bash
npm run typecheck
```

### Outputs

| File | Description |
|------|-------------|
| `output/langgraph-report.json` | Full workflow state (raw data, cleaned data, repairs, anomalies, scores) |
| `output/clean-vs-dirty-report.md` | Human-readable summary with repairs and customer-facing anomalies |

### Note

This TypeScript engine is currently on the **`langgraph-typescript-engine`** branch and should **not** replace the Python MVP yet. The Python validator in `app/validator.py` remains the baseline for comparison.
