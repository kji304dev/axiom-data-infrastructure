import { useCallback, useEffect, useState } from "react";

import { fetchRunArtifact, fetchRuns } from "../api/runs.js";
import { getBackendErrorMessage } from "../api/errors.js";
import type { GradeArtifact, RunIndexEntry } from "../types/runs.js";
import { AnalysisResult } from "./AnalysisResult.js";

interface RunHistoryProps {
  refreshKey?: number;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatInputType(inputType: RunIndexEntry["input_type"]): string {
  if (inputType === "csv_upload") {
    return "CSV upload";
  }
  if (inputType === "json") {
    return "JSON";
  }
  return inputType;
}

export function RunHistory({ refreshKey = 0 }: RunHistoryProps) {
  const [runs, setRuns] = useState<RunIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<GradeArtifact | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchRuns();
      setRuns(response.runs);
    } catch (error) {
      setError(
        getBackendErrorMessage(
          error,
          "Could not load run history. Check the API base URL and backend deployment.",
        ),
      );
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns, refreshKey]);

  async function handleViewResult(runId: string) {
    setSelectedRunId(runId);
    setArtifact(null);
    setArtifactError(null);
    setArtifactLoading(true);

    try {
      const result = await fetchRunArtifact(runId);
      setArtifact(result);
    } catch (error) {
      setArtifactError(
        getBackendErrorMessage(
          error,
          "Could not load run artifact. Check the API base URL and backend deployment.",
        ),
      );
    } finally {
      setArtifactLoading(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="run-history-heading">
      <div className="panel-header">
        <h2 id="run-history-heading">Run History</h2>
      </div>
      <p className="panel-lead">
        Previous grading runs are stored for this demo session so you can reopen
        results and inspect artifacts.
      </p>

      {loading ? (
        <p className="loading-inline" role="status">
          <span className="spinner" aria-hidden="true" />
          Loading run history...
        </p>
      ) : error ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : runs.length === 0 ? (
        <div className="empty-state">
          <strong>No runs yet</strong>
          <p>
            Grade sample JSON or upload a CSV/JSON file to create your first
            analysis.
          </p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Date / time</th>
                <th scope="col">Input</th>
                <th scope="col">Records</th>
                <th scope="col">Health</th>
                <th scope="col">Validation</th>
                <th scope="col">Failed</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.run_id}
                  data-testid={`run-row-${run.run_id}`}
                >
                  <td>
                    <div>{formatTimestamp(run.created_at)}</div>
                    <div className="run-meta">{run.run_id}</div>
                  </td>
                  <td>{formatInputType(run.input_type)}</td>
                  <td>{run.record_count}</td>
                  <td>{run.health_score}</td>
                  <td>
                    <span
                      className={
                        run.validation_passed
                          ? "badge badge-success"
                          : "badge badge-danger"
                      }
                    >
                      {run.validation_passed ? "passed" : "failed"}
                    </span>
                  </td>
                  <td>{run.failed_record_count}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void handleViewResult(run.run_id)}
                    >
                      View Result
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRunId && artifactLoading ? (
        <p className="loading-inline" role="status" style={{ marginTop: "1rem" }}>
          <span className="spinner" aria-hidden="true" />
          Loading artifact for {selectedRunId}...
        </p>
      ) : null}

      {artifactError ? (
        <p className="alert alert-error" role="alert" style={{ marginTop: "1rem" }}>
          {artifactError}
        </p>
      ) : null}

      {artifact ? (
        <div style={{ marginTop: "1.25rem" }}>
          <AnalysisResult
            artifact={artifact}
            title="Saved Run Result"
            showRawJson
          />
        </div>
      ) : null}
    </section>
  );
}
