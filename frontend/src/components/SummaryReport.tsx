import type { CleanVsDirtySummary } from "../types/summary.js";

interface SummaryReportProps {
  summary: CleanVsDirtySummary | null | undefined;
}

export function SummaryReport({ summary }: SummaryReportProps) {
  if (!summary) {
    return null;
  }

  return (
    <section aria-labelledby="summary-report-heading" data-testid="summary-report">
      <h3 id="summary-report-heading">Clean-vs-Dirty Summary Report</h3>
      <p>{summary.headline}</p>
      <dl>
        <div>
          <dt>Data grade</dt>
          <dd>{summary.data_grade}</dd>
        </div>
        <div>
          <dt>Health score</dt>
          <dd>{summary.health_score}</dd>
        </div>
        <div>
          <dt>Records received</dt>
          <dd>{summary.records_received}</dd>
        </div>
        <div>
          <dt>Records clean</dt>
          <dd>{summary.records_clean}</dd>
        </div>
        <div>
          <dt>Records flagged</dt>
          <dd>{summary.records_flagged}</dd>
        </div>
      </dl>

      {summary.top_issues.length > 0 ? (
        <div>
          <h4>Top issues</h4>
          <ul>
            {summary.top_issues.map((issue) => (
              <li key={`${issue.field}-${issue.issue}`}>
                {issue.field}: {issue.issue} ({issue.count})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.recommended_next_steps.length > 0 ? (
        <div>
          <h4>Recommended next steps</h4>
          <ul>
            {summary.recommended_next_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
