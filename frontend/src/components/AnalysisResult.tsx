import type { CleanVsDirtySummary } from "../types/summary.js";
import type {
  Anomaly,
  FailedRecord,
  GradeArtifact,
  HealthScoreExplanation,
  ProcessingEvent,
  Repair,
} from "../types/artifact.js";
import {
  asAnomalies,
  asFailedRecords,
  asHealthScoreExplanation,
  asProcessingHistory,
  asRepairs,
  formatDisplayValue,
} from "../types/artifact.js";
import { isCleanVsDirtySummary } from "../types/summary.js";

interface AnalysisResultProps {
  artifact: GradeArtifact;
  title?: string;
  showRawJson?: boolean;
}

const NODE_ORDER = [
  "analyzer",
  "transformer",
  "auditor",
  "validator",
  "complete",
] as const;

function issueSeverityLabel(
  field: string,
  issue: string,
  anomalies: Anomaly[],
): string {
  const matching = anomalies.filter(
    (anomaly) => anomaly.field === field && anomaly.issue === issue,
  );
  if (matching.some((anomaly) => anomaly.severity === "high")) {
    return "High";
  }
  if (matching.some((anomaly) => anomaly.severity === "medium")) {
    return "Medium";
  }
  if (matching.some((anomaly) => anomaly.severity === "low")) {
    return "Low";
  }
  if (issue.toLowerCase().includes("requires review")) {
    return "Review";
  }
  return "Flagged";
}

function severityBadgeClass(label: string): string {
  if (label === "High") {
    return "badge badge-danger";
  }
  if (label === "Review" || label === "Medium") {
    return "badge badge-warn";
  }
  if (label === "Low") {
    return "badge badge-info";
  }
  return "badge badge-neutral";
}

function buildPipelineStages(history: ProcessingEvent[]) {
  const byNode = new Map<string, ProcessingEvent>();
  for (const event of history) {
    const existing = byNode.get(event.node);
    if (!existing) {
      byNode.set(event.node, event);
      continue;
    }
    const rank = { failed: 4, retry: 3, success: 2, start: 1 } as const;
    if (rank[event.status] >= rank[existing.status]) {
      byNode.set(event.node, event);
    }
  }

  return NODE_ORDER.filter((node) => byNode.has(node)).map((node) => {
    const event = byNode.get(node)!;
    return { node, status: event.status, message: event.message };
  });
}

function HealthExplanation({
  score,
  explanation,
}: {
  score: number;
  explanation: HealthScoreExplanation;
}) {
  return (
    <details className="score-explain">
      <summary>Why is the score {score}?</summary>
      <div className="score-explain-body">
        <p>
          The health score reflects the complete quality and validation result,
          including unresolved failures and review-required repairs — not only
          the clean/flagged record ratio.
        </p>
        <ul>
          <li>Starting score: {explanation.starting_score}</li>
          <li>
            High-severity anomalies: {explanation.high_severity_anomaly_count}
          </li>
          <li>
            Medium-severity anomalies:{" "}
            {explanation.medium_severity_anomaly_count}
          </li>
          <li>
            Review-required repairs: {explanation.review_required_repair_count}
          </li>
          <li>Confident repairs: {explanation.confident_repair_count}</li>
          <li>Failed / quarantined records: {explanation.failed_record_count}</li>
          <li>Final score: {explanation.final_score}</li>
        </ul>
      </div>
    </details>
  );
}

function IssuesSection({
  summary,
  anomalies,
}: {
  summary: CleanVsDirtySummary;
  anomalies: Anomaly[];
}) {
  return (
    <section aria-labelledby="issues-heading">
      <div className="panel-header">
        <h3 id="issues-heading">Issues Detected</h3>
      </div>
      {summary.top_issues.length === 0 ? (
        <p className="helper-text">No issues were detected in this run.</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Issue</th>
                <th scope="col">Records</th>
                <th scope="col">Severity</th>
              </tr>
            </thead>
            <tbody>
              {summary.top_issues.map((issue) => {
                const severity = issueSeverityLabel(
                  issue.field,
                  issue.issue,
                  anomalies,
                );
                return (
                  <tr key={`${issue.field}-${issue.issue}`}>
                    <td>
                      <strong>{issue.issue}</strong>
                      <div className="run-meta">Field: {issue.field}</div>
                    </td>
                    <td>{issue.count}</td>
                    <td>
                      <span className={severityBadgeClass(severity)}>
                        {severity}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RepairsSection({ repairs }: { repairs: Repair[] }) {
  return (
    <section aria-labelledby="repairs-heading">
      <div className="panel-header">
        <h3 id="repairs-heading">What ADI Repaired</h3>
      </div>
      {repairs.length === 0 ? (
        <p className="helper-text">No repairs were necessary.</p>
      ) : (
        <ul className="repair-list">
          {repairs.map((repair) => (
            <li
              key={`${repair.row}-${repair.field}-${repair.action_taken}-${repair.original_value}-${repair.cleaned_value}`}
              className="repair-item"
            >
              <span className="badge badge-neutral">Row {repair.row}</span>
              <div>
                <div className="repair-change">
                  <span>{formatDisplayValue(repair.original_value)}</span>
                  <span className="arrow">→</span>
                  <span>{formatDisplayValue(repair.cleaned_value)}</span>
                </div>
                <p className="repair-meta">
                  {repair.field} · {repair.action_taken}
                  {typeof repair.confidence === "number"
                    ? ` · confidence ${repair.confidence}`
                    : null}
                </p>
              </div>
              <span
                className={
                  repair.requires_review
                    ? "badge badge-warn"
                    : "badge badge-success"
                }
              >
                {repair.requires_review ? "Needs review" : "Automatic"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FailedRecordsSection({ failed }: { failed: FailedRecord[] }) {
  return (
    <section aria-labelledby="failed-heading">
      <div className="panel-header">
        <h3 id="failed-heading">Unresolved / Flagged Records</h3>
      </div>
      {failed.length === 0 ? (
        <p className="helper-text">
          No records needed to be quarantined for this run.
        </p>
      ) : (
        <>
          <div className="failed-callout" role="status">
            <span aria-hidden="true">⚠</span>
            <div>
              <p className="lede">
                {failed.length} record{failed.length === 1 ? "" : "s"} could not
                be safely repaired
              </p>
              <p className="sub">
                These records were quarantined rather than allowing invalid data
                to pass through.
              </p>
            </div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((item) => (
                  <tr key={`${item.row}-${item.reason}`}>
                    <td>{item.row}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function PipelineSection({ history }: { history: ProcessingEvent[] }) {
  const stages = buildPipelineStages(history);
  if (stages.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="pipeline-heading">
      <div className="panel-header">
        <h3 id="pipeline-heading">Processing Pipeline</h3>
      </div>
      <p className="helper-text" style={{ marginBottom: "0.85rem" }}>
        Analyze → repair → audit → retry → validate unresolved data.
      </p>
      <ol className="pipeline">
        {stages.map((stage, index) => (
          <li key={stage.node} style={{ display: "contents" }}>
            {index > 0 ? (
              <span className="pipeline-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
            <div className="pipeline-step" data-status={stage.status}>
              <span className="pipeline-node">{stage.node}</span>
              <span className="pipeline-status">{stage.status}</span>
            </div>
          </li>
        ))}
      </ol>
      <details className="pipeline-details">
        <summary>Event log</summary>
        <ol className="pipeline-event-list">
          {history.map((event, index) => (
            <li key={`${event.node}-${event.status}-${event.timestamp}-${index}`}>
              <strong>{event.node}</strong> ({event.status}
              {event.retry_count ? `, retry ${event.retry_count}` : ""}):{" "}
              {event.message}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

function NextStepsSection({ steps }: { steps: string[] }) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="next-steps-heading">
      <div className="panel-header">
        <h3 id="next-steps-heading">Recommended Next Steps</h3>
      </div>
      <ul className="steps-list">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </section>
  );
}

export function AnalysisResult({
  artifact,
  title = "Latest Analysis",
  showRawJson = true,
}: AnalysisResultProps) {
  const summary = isCleanVsDirtySummary(artifact.summary)
    ? artifact.summary
    : null;
  const repairs = asRepairs(artifact.repairs);
  const anomalies = asAnomalies(artifact.anomalies);
  const failed = asFailedRecords(artifact.failed_records);
  const history = asProcessingHistory(artifact.processing_history);
  const explanation = asHealthScoreExplanation(
    artifact.health_score_explanation,
  );
  const validationPassed = Boolean(artifact.validation_passed);
  const healthScore =
    summary?.health_score ??
    (typeof artifact.health_score === "number" ? artifact.health_score : null);

  // Prefer backend validation_passed — do not infer from headline text
  // (e.g. "not ready for import" contains the substring "ready for import").
  const readyForImport = validationPassed;

  return (
    <section
      className="panel stack"
      aria-labelledby="analysis-heading"
      data-testid="summary-report"
    >
      <div className="panel-header">
        <h2 id="analysis-heading">{title}</h2>
        {artifact.run_id ? (
          <span className="run-meta">Run {String(artifact.run_id)}</span>
        ) : null}
      </div>

      {summary ? (
        <>
          <div className="grade-hero">
            <div
              className="grade-mark"
              data-ready={readyForImport ? "true" : "false"}
            >
              <div className="grade-letter">{summary.data_grade}</div>
              <p className="grade-ready-label">
                {readyForImport
                  ? "Ready for import"
                  : "Not ready for import"}
              </p>
            </div>
            <div className="grade-meta">
              <p className="grade-headline">{summary.headline}</p>
              <dl className="metric-grid">
                <div className="metric-card">
                  <dt>Health Score</dt>
                  <dd>
                    {summary.health_score}
                    <span className="metric-sub"> / 100</span>
                  </dd>
                </div>
                <div className="metric-card">
                  <dt>Records received</dt>
                  <dd>{summary.records_received}</dd>
                </div>
                <div className="metric-card">
                  <dt>Records clean</dt>
                  <dd>{summary.records_clean}</dd>
                </div>
                <div className="metric-card">
                  <dt>Records flagged</dt>
                  <dd>{summary.records_flagged}</dd>
                </div>
                <div className="metric-card">
                  <dt>Validation</dt>
                  <dd>
                    <span
                      className={
                        validationPassed
                          ? "badge badge-success"
                          : "badge badge-danger"
                      }
                    >
                      {validationPassed ? "Passed" : "Failed"}
                    </span>
                  </dd>
                </div>
              </dl>
              {explanation && healthScore !== null ? (
                <HealthExplanation
                  score={healthScore}
                  explanation={explanation}
                />
              ) : null}
            </div>
          </div>

          <IssuesSection summary={summary} anomalies={anomalies} />
          <RepairsSection repairs={repairs} />
          <FailedRecordsSection failed={failed} />
          <PipelineSection history={history} />
          <NextStepsSection steps={summary.recommended_next_steps} />
        </>
      ) : (
        <p className="helper-text">
          This artifact does not include a Clean-vs-Dirty summary. Open raw JSON
          below for the full payload.
        </p>
      )}

      {showRawJson ? (
        <div className="raw-json">
          <details>
            <summary>Saved artifact (raw JSON)</summary>
            <pre data-testid="artifact-preview">
              {JSON.stringify(artifact, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}

/** Backwards-compatible summary-only view used by existing tests. */
export function SummaryReport({
  summary,
}: {
  summary: CleanVsDirtySummary | null | undefined;
}) {
  if (!summary) {
    return null;
  }

  return (
    <AnalysisResult
      artifact={{
        summary,
        // Summary-only view has no validation_passed; grade A is the ready case.
        validation_passed: summary.data_grade === "A",
      }}
      title="Clean-vs-Dirty Summary Report"
      showRawJson={false}
    />
  );
}
