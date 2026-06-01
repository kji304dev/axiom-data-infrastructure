import type { ADIStateUpdate, ADIGraphState, Anomaly } from "../types/state.js";
import { classifyRowStatuses } from "./rowStatus.js";
import { recommendOperatorDecisions } from "./operatorDecision.js";

export const HIGH_ANOMALY_PENALTY = 20;
export const MEDIUM_ANOMALY_PENALTY = 10;
export const REVIEW_REPAIR_PENALTY = 5;
export const AUTO_REPAIR_PENALTY = 2;

export interface HealthScoreBreakdown {
  startingScore: number;
  highAnomalyCount: number;
  highAnomalyDeduction: number;
  mediumAnomalyCount: number;
  mediumAnomalyDeduction: number;
  reviewRepairCount: number;
  reviewRepairDeduction: number;
  confidentRepairCount: number;
  confidentRepairDeduction: number;
  finalScore: number;
}

/** Anomalies that affect the health score (excludes internal structural validation). */
export function getScoringAnomalies(anomalies: Anomaly[]): Anomaly[] {
  return anomalies.filter((anomaly) => anomaly.field !== "cleanedData");
}

export function buildHealthScoreBreakdown(
  state: ADIGraphState,
): HealthScoreBreakdown {
  const scoringAnomalies = getScoringAnomalies(state.anomalies);
  const highAnomalyCount = scoringAnomalies.filter(
    (anomaly) => anomaly.severity === "high",
  ).length;
  const mediumAnomalyCount = scoringAnomalies.filter(
    (anomaly) => anomaly.severity === "medium",
  ).length;
  const reviewRepairCount = state.repairs.filter(
    (repair) => repair.requiresReview,
  ).length;
  const confidentRepairCount = state.repairs.length - reviewRepairCount;

  const highAnomalyDeduction = highAnomalyCount * HIGH_ANOMALY_PENALTY;
  const mediumAnomalyDeduction = mediumAnomalyCount * MEDIUM_ANOMALY_PENALTY;
  const reviewRepairDeduction = reviewRepairCount * REVIEW_REPAIR_PENALTY;
  const confidentRepairDeduction = confidentRepairCount * AUTO_REPAIR_PENALTY;

  const finalScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        highAnomalyDeduction -
        mediumAnomalyDeduction -
        reviewRepairDeduction -
        confidentRepairDeduction,
    ),
  );

  return {
    startingScore: 100,
    highAnomalyCount,
    highAnomalyDeduction,
    mediumAnomalyCount,
    mediumAnomalyDeduction,
    reviewRepairCount,
    reviewRepairDeduction,
    confidentRepairCount,
    confidentRepairDeduction,
    finalScore,
  };
}

export function calculateHealthScore(state: ADIGraphState): number {
  return buildHealthScoreBreakdown(state).finalScore;
}

/**
 * Grader node: derives an operational data health score from anomalies
 * and repairs (0–100, higher is healthier).
 */
export function graderNode(state: ADIGraphState): ADIStateUpdate {
  const rowStatuses = classifyRowStatuses(state);

  return {
    healthScore: calculateHealthScore(state),
    rowStatuses,
    operatorDecisions: recommendOperatorDecisions(rowStatuses),
    currentStep: "complete",
  };
}
