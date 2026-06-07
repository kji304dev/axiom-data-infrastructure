export interface SummaryTopIssue {
  field: string;
  issue: string;
  count: number;
}

export interface CleanVsDirtySummary {
  headline: string;
  data_grade: "A" | "B" | "C" | "D" | "F";
  health_score: number;
  records_received: number;
  records_clean: number;
  records_flagged: number;
  top_issues: SummaryTopIssue[];
  recommended_next_steps: string[];
}

export function isCleanVsDirtySummary(value: unknown): value is CleanVsDirtySummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const summary = value as Record<string, unknown>;
  return (
    typeof summary.headline === "string" &&
    typeof summary.data_grade === "string" &&
    typeof summary.health_score === "number" &&
    typeof summary.records_received === "number" &&
    typeof summary.records_clean === "number" &&
    typeof summary.records_flagged === "number" &&
    Array.isArray(summary.top_issues) &&
    Array.isArray(summary.recommended_next_steps)
  );
}
