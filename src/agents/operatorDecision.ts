import type {
  OperatorDecision,
  RecommendedDecision,
  RowStatus,
  RowStatusKind,
} from "../types/state.js";

const DECISION_BY_STATUS: Record<RowStatusKind, RecommendedDecision> = {
  clean: "approved",
  repaired: "approved_with_changes",
  needs_review: "needs_customer_input",
  rejected: "rejected",
};

const DECISION_REASON_PREFIX: Record<RowStatusKind, string> = {
  clean: "Row passed with no repairs or anomalies",
  repaired: "Row was auto-repaired and is ready for approval with changes",
  needs_review: "Row has repairs or issues that require customer input",
  rejected: "Row cannot be approved due to unrecoverable data quality issues",
};

export function recommendOperatorDecision(rowStatus: RowStatus): OperatorDecision {
  return {
    row: rowStatus.row,
    recommendedDecision: DECISION_BY_STATUS[rowStatus.status],
    reason: `${DECISION_REASON_PREFIX[rowStatus.status]}: ${rowStatus.reason}`,
  };
}

export function recommendOperatorDecisions(
  rowStatuses: RowStatus[],
): OperatorDecision[] {
  return rowStatuses.map(recommendOperatorDecision);
}

export function getOperatorDecision(
  operatorDecisions: OperatorDecision[],
  csvRow: number,
): OperatorDecision | undefined {
  return operatorDecisions.find((decision) => decision.row === csvRow);
}
