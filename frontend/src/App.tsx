import { useState } from "react";

import { gradeAecCsvUpload, gradeAecRecords } from "./api/grade.js";
import { getBackendErrorMessage } from "./api/errors.js";
import { BackendStatus } from "./components/BackendStatus.js";
import { AnalysisResult } from "./components/AnalysisResult.js";
import { RunHistory } from "./components/RunHistory.js";
import type { GradeArtifact } from "./types/runs.js";

const SAMPLE_RECORD = {
  ticket_id: "1002",
  date: "05/02/26",
  customer: "Acme",
  material: "Gravel",
  quantity: -4,
  unit: "tons",
  job_site: "North Yard",
};

async function readJsonRecords(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);

  if (Array.isArray(parsed)) {
    return parsed as Record<string, unknown>[];
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { records?: unknown }).records)
  ) {
    return (parsed as { records: Record<string, unknown>[] }).records;
  }

  throw new Error(
    "JSON file must be an array of records or an object with a records array.",
  );
}

export function App() {
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [gradeMessage, setGradeMessage] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [latestResult, setLatestResult] = useState<GradeArtifact | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  async function handleGradeJson() {
    setGradeMessage(null);
    setGradeError(null);
    setIsGrading(true);

    try {
      const payload = await gradeAecRecords([SAMPLE_RECORD]);
      setLatestResult(payload);
      setGradeMessage(
        `Graded sample JSON${payload.run_id ? ` · run ${payload.run_id}` : ""}`,
      );
      setHistoryRefreshKey((value) => value + 1);
    } catch (error) {
      setGradeError(
        getBackendErrorMessage(
          error,
          "Could not grade sample JSON record. Check the API base URL and backend deployment.",
        ),
      );
    } finally {
      setIsGrading(false);
    }
  }

  async function handleUploadFile() {
    setGradeMessage(null);
    setGradeError(null);

    if (!uploadFile) {
      setGradeError("Choose a CSV or JSON file before uploading.");
      return;
    }

    setIsGrading(true);

    try {
      const lowerName = uploadFile.name.toLowerCase();
      let payload: GradeArtifact;

      if (lowerName.endsWith(".json")) {
        const records = await readJsonRecords(uploadFile);
        payload = await gradeAecRecords(records);
      } else {
        payload = await gradeAecCsvUpload(uploadFile);
      }

      setLatestResult(payload);
      setGradeMessage(
        `Uploaded ${uploadFile.name}${
          payload.run_id ? ` · run ${payload.run_id}` : ""
        }`,
      );
      setHistoryRefreshKey((value) => value + 1);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setGradeError("Could not parse JSON file. Check that the file is valid JSON.");
      } else if (error instanceof Error && error.message.includes("records")) {
        setGradeError(error.message);
      } else {
        setGradeError(
          getBackendErrorMessage(
            error,
            "Could not upload file for grading. Check the API base URL and backend deployment.",
          ),
        );
      }
    } finally {
      setIsGrading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark">
            <h1 className="brand-name">ADI</h1>
            <p className="brand-tag">Axiom Data Infrastructure</p>
          </div>
          <p className="brand-subtitle">
            Data quality intelligence for messy operational data — upload,
            analyze, repair what is safe, and quarantine what is not.
          </p>
        </div>
        <BackendStatus />
      </header>

      <main>
        <section className="panel" aria-labelledby="grading-heading">
          <div className="panel-header">
            <h2 id="grading-heading">Grade Your Data</h2>
          </div>
          <p className="panel-lead">
            Upload a CSV or JSON file to analyze its quality. Or run the built-in
            sample to see how ADI handles messy ticket data.
          </p>

          <div className="stack">
            <div className="row">
              <div className="file-field">
                <label htmlFor="data-upload">Upload CSV or JSON</label>
                <input
                  id="data-upload"
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={(event) =>
                    setUploadFile(event.target.files?.[0] ?? null)
                  }
                />
                <p className="helper-text">
                  Try <code>samples/aec_messy_sample.csv</code> or{" "}
                  <code>samples/aec_messy_sample.json</code>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isGrading}
                onClick={() => void handleUploadFile()}
              >
                {isGrading ? "Analyzing…" : "Upload & Analyze"}
              </button>
            </div>

            <div className="row">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isGrading}
                onClick={() => void handleGradeJson()}
              >
                Grade Sample JSON
              </button>
              {isGrading ? (
                <span className="loading-inline" role="status">
                  <span className="spinner" aria-hidden="true" />
                  Running analysis…
                </span>
              ) : null}
            </div>

            {gradeMessage ? (
              <p className="alert alert-success" role="status">
                {gradeMessage}
              </p>
            ) : null}
            {gradeError ? (
              <p className="alert alert-error" role="alert">
                {gradeError}
              </p>
            ) : null}
          </div>
        </section>

        {latestResult ? (
          <AnalysisResult artifact={latestResult} title="Latest Analysis" />
        ) : (
          <section className="panel" aria-labelledby="empty-analysis-heading">
            <div className="panel-header">
              <h2 id="empty-analysis-heading">Latest Analysis</h2>
            </div>
            <div className="empty-state">
              <strong>No analysis yet</strong>
              <p>
                Upload operational data or grade the sample JSON to see health
                score, repairs, quarantined records, and recommended next steps.
              </p>
            </div>
          </section>
        )}

        <RunHistory refreshKey={historyRefreshKey} />
      </main>
    </div>
  );
}
