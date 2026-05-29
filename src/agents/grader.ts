import type {
  ADIStateUpdate,
  ADIGraphState,
  AnomalySeverity,
} from "../types/state.js";

const SEVERITY_PENALTY: Record<AnomalySeverity, number> = {
  low: 2,
  medium: 5,
  high: 10,
};

/**
 * Grader node: derives an operational data health score from cleaned rows
 * and accumulated anomalies (0–100, higher is healthier).
 */
export function graderNode(state: ADIGraphState): ADIStateUpdate {
  const totalRows = Math.max(state.rawData.length, 1);
  const cleanRatio = state.cleanedData.length / totalRows;
  const baseScore = cleanRatio * 100;

  const anomalyPenalty = state.anomalies.reduce(
    (sum, anomaly) => sum + SEVERITY_PENALTY[anomaly.severity],
    0,
  );

  const normalizedPenalty = Math.min(
    anomalyPenalty,
    baseScore,
  );

  const healthScore = Math.round(
    Math.max(0, Math.min(100, baseScore - normalizedPenalty)),
  );

  return {
    healthScore,
    currentStep: "complete",
  };
}
