import type { Anomaly } from "../types/state.js";

export function isUserFacingAnomaly(anomaly: Anomaly): boolean {
  return anomaly.field !== "cleanedData";
}

export function getUserFacingAnomalies(anomalies: Anomaly[]): Anomaly[] {
  return anomalies.filter(isUserFacingAnomaly);
}

export interface AnomalySummary {
  userFacing: number;
  internal: number;
}

export function summarizeAnomalies(anomalies: Anomaly[]): AnomalySummary {
  return {
    userFacing: getUserFacingAnomalies(anomalies).length,
    internal: anomalies.length,
  };
}
