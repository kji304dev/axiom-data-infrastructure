import { useState } from "react";

import { getApiBaseUrl } from "./api/config.js";
import { RunHistory } from "./components/RunHistory.js";

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

  async function handleGradeJson() {
    setGradeMessage(null);
    setGradeError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/grade/aec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: [SAMPLE_RECORD] }),
      });

      if (!response.ok) {
        throw new Error(`Grade request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { run_id?: string };
      setGradeMessage(`Graded sample JSON run ${payload.run_id ?? ""}`.trim());
      setHistoryRefreshKey((value) => value + 1);
    } catch {
      setGradeError("Unable to grade sample JSON record.");
    }
  }

  async function handleUploadCsv() {
    setGradeMessage(null);
    setGradeError(null);

    if (!csvFile) {
      setGradeError("Choose a CSV file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const response = await fetch(`${getApiBaseUrl()}/grade/aec/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { run_id?: string };
      setGradeMessage(`Uploaded CSV run ${payload.run_id ?? ""}`.trim());
      setHistoryRefreshKey((value) => value + 1);
    } catch {
      setGradeError("Unable to upload CSV for grading.");
    }
  }

  return (
    <main>
      <h1>ADI Grading Demo</h1>
      <p>API base URL: {getApiBaseUrl()}</p>

      <section aria-labelledby="grading-heading">
        <h2 id="grading-heading">Grade Data</h2>
        <button type="button" onClick={() => void handleGradeJson()}>
          Grade Sample JSON
        </button>
        <div>
          <input
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
      </section>

      <RunHistory refreshKey={historyRefreshKey} />
    </main>
  );
}
