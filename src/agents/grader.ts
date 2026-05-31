import type { ADIStateUpdate, ADIGraphState } from "../types/state.js";

const HIGH_ANOMALY_PENALTY = 20;
const MEDIUM_ANOMALY_PENALTY = 10;
const REVIEW_REPAIR_PENALTY = 5;
const AUTO_REPAIR_PENALTY = 2;

export function calculateHealthScore(state: ADIGraphState): number {
  let score = 100;

  for (const anomaly of state.anomalies) {
    if (anomaly.severity === "high") {
      score -= HIGH_ANOMALY_PENALTY;
    } else if (anomaly.severity === "medium") {
      score -= MEDIUM_ANOMALY_PENALTY;
    }
  }

  for (const repair of state.repairs) {
    if (repair.requiresReview) {
      score -= REVIEW_REPAIR_PENALTY;
    } else {
      score -= AUTO_REPAIR_PENALTY;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Grader node: derives an operational data health score from anomalies
 * and repairs (0–100, higher is healthier).
 */
export function graderNode(state: ADIGraphState): ADIStateUpdate {
  return {
    healthScore: calculateHealthScore(state),
    currentStep: "complete",
  };
}
