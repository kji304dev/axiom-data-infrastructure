import { useState } from "react";

import { gradeAecCsvUpload, gradeAecRecords } from "./api/grade.js";
import { getBackendErrorMessage } from "./api/errors.js";
import { BackendStatus } from "./components/BackendStatus.js";
import { SummaryReport } from "./components/SummaryReport.js";
import { RunHistory } from "./components/RunHistory.js";
import type { GradeArtifact } from "./types/runs.js";
import { isCleanVsDirtySummary } from "./types/summary.js";

const SAMPLE_RECORD = {
  ticket_id: "1002",
  date: "05/02/26",
  customer: "Acme",
  material: "Gravel",
  quantity: -4,
  unit: "tons",
  job_site: "North Yard",
};

export function App() {
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [gradeMessage, setGradeMessage] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [latestResult, setLatestResult] = useState<GradeArtifact | null>(null);

  async function handleGradeJson() {
    setGradeMessage(null);
    setGradeError(null);

    try {
      const payload = await gradeAecRecords([SAMPLE_RECORD]);
      setLatestResult(payload);
      setGradeMessage(`Graded sample JSON run ${payload.run_id ?? ""}`.trim());
      setHistoryRefreshKey((value) => value + 1);
    } catch (error) {
      setGradeError(
        getBackendErrorMessage(
          error,
          "Could not grade sample JSON record. Check the API base URL and backend deployment.",
        ),
      );
    }
  }

  async function handleUploadCsv() {
    setGradeMessage(null);
    setGradeError(null);

    if (!csvFile) {
      setGradeError("Choose a CSV file before uploading.");
      return;
    }

    try {
      const payload = await gradeAecCsvUpload(csvFile);
      setLatestResult(payload);
      setGradeMessage(`Uploaded CSV run ${payload.run_id ?? ""}`.trim());
      setHistoryRefreshKey((value) => value + 1);
    } catch (error) {
      setGradeError(
        getBackendErrorMessage(
          error,
          "Could not upload CSV for grading. Check the API base URL and backend deployment.",
        ),
      );
    }
  }

  return (
    <main>
      <h1>ADI Grading Demo</h1>

      <BackendStatus />

      <section aria-labelledby="grading-heading">
        <h2 id="grading-heading">Grade Data</h2>
        <button type="button" onClick={() => void handleGradeJson()}>
          Grade Sample JSON
        </button>
        <div>
          <label htmlFor="csv-upload">
            Upload CSV (try <code>samples/aec_messy_sample.csv</code>)
          </label>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
          />
          <button type="button" onClick={() => void handleUploadCsv()}>
            Upload CSV
          </button>
        </div>
        {gradeMessage ? <p>{gradeMessage}</p> : null}
        {gradeError ? <p role="alert">{gradeError}</p> : null}
        <SummaryReport
          summary={
            latestResult && isCleanVsDirtySummary(latestResult.summary)
              ? latestResult.summary
              : null
          }
        />
      </section>

      <RunHistory refreshKey={historyRefreshKey} />
    </main>
  );
}
