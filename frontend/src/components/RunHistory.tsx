import { useCallback, useEffect, useState } from "react";

import { fetchRunArtifact, fetchRuns } from "../api/runs.js";
import type { GradeArtifact, RunIndexEntry } from "../types/runs.js";

interface RunHistoryProps {
  refreshKey?: number;
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
    } catch {
      setError("Unable to load run history.");
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
    } catch {
      setArtifactError("Unable to load run artifact.");
    } finally {
      setArtifactLoading(false);
    }
  }

  return (
    <section aria-labelledby="run-history-heading">
      <h2 id="run-history-heading">Run History</h2>
      <p>
        Previous grading runs are stored locally during MVP development and can
        later map to DynamoDB/S3-backed history.
      </p>

      {loading ? (
        <p role="status">Loading run history...</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : runs.length === 0 ? (
        <p>No runs yet. Grade JSON or upload CSV to create the first run.</p>
      ) : (
        <ul>
          {runs.map((run) => (
            <li key={run.run_id} data-testid={`run-row-${run.run_id}`}>
              <strong>{run.run_id}</strong>
              <span> | {run.created_at}</span>
              <span> | {run.input_type}</span>
              <span> | records: {run.record_count}</span>
              <span> | health: {run.health_score}</span>
              <span>
                {" "}
                | validation: {run.validation_passed ? "passed" : "failed"}
              </span>
              <span> | failed records: {run.failed_record_count}</span>
              <button type="button" onClick={() => void handleViewResult(run.run_id)}>
                View Result
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedRunId && artifactLoading ? (
        <p role="status">Loading artifact for {selectedRunId}...</p>
      ) : null}

      {artifactError ? <p role="alert">{artifactError}</p> : null}

      {artifact ? (
        <pre data-testid="artifact-preview">
          {JSON.stringify(artifact, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
