import type {
  ADIGraphState,
  Anomaly,
  Repair,
  RowStatus,
} from "../types/state.js";

function getRowRepairs(repairs: Repair[], csvRow: number): Repair[] {
  return repairs.filter((repair) => repair.row === csvRow);
}

function getRowAnomalies(anomalies: Anomaly[], csvRow: number): Anomaly[] {
  return anomalies.filter(
    (anomaly) => anomaly.field !== "cleanedData" && anomaly.row === csvRow,
  );
}

function buildRejectedReason(anomalies: Anomaly[]): string {
  return anomalies
    .map((anomaly) => `${anomaly.field}: ${anomaly.issue}`)
    .join("; ");
}

function buildNeedsReviewReason(repairs: Repair[], anomalies: Anomaly[]): string {
  const reviewFields = repairs
    .filter((repair) => repair.requiresReview)
    .map((repair) => repair.field);

  if (reviewFields.length > 0) {
    return `Repairs require operator review (${reviewFields.join(", ")})`;
  }

  return anomalies.map((anomaly) => anomaly.issue).join("; ");
}

function buildRepairedReason(repairs: Repair[]): string {
  const fields = repairs.map((repair) => repair.field);
  return `Repairs applied with high confidence (${fields.join(", ")})`;
}

export function classifyRowStatus(
  csvRow: number,
  repairs: Repair[],
  anomalies: Anomaly[],
): RowStatus {
  const rowRepairs = getRowRepairs(repairs, csvRow);
  const rowAnomalies = getRowAnomalies(anomalies, csvRow);
  const highAnomalies = rowAnomalies.filter(
    (anomaly) => anomaly.severity === "high",
  );

  if (highAnomalies.length > 0) {
    return {
      row: csvRow,
      status: "rejected",
      reason: buildRejectedReason(highAnomalies),
    };
  }

  if (rowRepairs.some((repair) => repair.requiresReview)) {
    return {
      row: csvRow,
      status: "needs_review",
      reason: buildNeedsReviewReason(rowRepairs, rowAnomalies),
    };
  }

  if (rowRepairs.length > 0) {
    return {
      row: csvRow,
      status: "repaired",
      reason: buildRepairedReason(rowRepairs),
    };
  }

  if (rowAnomalies.length > 0) {
    return {
      row: csvRow,
      status: "needs_review",
      reason: buildNeedsReviewReason(rowRepairs, rowAnomalies),
    };
  }

  return {
    row: csvRow,
    status: "clean",
    reason: "No repairs or anomalies",
  };
}

export function classifyRowStatuses(state: ADIGraphState): RowStatus[] {
  return state.rawData.map((_, index) =>
    classifyRowStatus(index + 2, state.repairs, state.anomalies),
  );
}

export function getRowStatus(
  rowStatuses: RowStatus[],
  csvRow: number,
): RowStatus | undefined {
  return rowStatuses.find((rowStatus) => rowStatus.row === csvRow);
}
