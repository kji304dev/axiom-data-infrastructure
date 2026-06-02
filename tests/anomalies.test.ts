import { describe, expect, it } from "vitest";
import { summarizeAnomalies } from "../src/io/anomalies.js";
import type { Anomaly } from "../src/types/state.js";

describe("summarizeAnomalies", () => {
  it("separates user-facing and internal anomaly counts", () => {
    const anomalies: Anomaly[] = [
      {
        row: 4,
        field: "date",
        issue: "Invalid date format",
        severity: "high",
      },
      {
        row: 0,
        field: "cleanedData",
        issue: "Structural validation failed",
        severity: "high",
      },
    ];

    expect(summarizeAnomalies(anomalies)).toEqual({
      userFacing: 1,
      internal: 2,
    });
  });
});
