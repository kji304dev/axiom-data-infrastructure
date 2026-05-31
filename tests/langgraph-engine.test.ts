import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runADIWorkflow } from "../src/engine/graph.js";
import { readTicketCsv } from "../src/io/csvReader.js";
import type { Anomaly } from "../src/types/state.js";

const DIRTY_SAMPLE_CSV = resolve("samples/dirty_aec_ticket.csv");
const CLEAN_SAMPLE_CSV = resolve("samples/clean_aec_ticket.csv");

function getUserFacingAnomalies(anomalies: Anomaly[]): Anomaly[] {
  return anomalies.filter((anomaly) => anomaly.field !== "cleanedData");
}

describe("LangGraph ADI engine", () => {
  it("cleans the dirty AEC ticket sample while preserving raw data", async () => {
    const rawData = readTicketCsv(DIRTY_SAMPLE_CSV);
    const result = await runADIWorkflow(rawData);

    const ticket1002Raw = result.rawData.find(
      (row) => row.ticket_id === "1002",
    );
    expect(ticket1002Raw?.date).toBe("05/02/26");
    expect(ticket1002Raw?.quantity).toBe("-4");

    const ticket1002Cleaned = result.cleanedData.find(
      (row) => row.ticket_id === "1002",
    );
    expect(ticket1002Cleaned?.date).toBe("2026-05-02");
    expect(ticket1002Cleaned?.quantity).toBe(4);

    expect(
      result.repairs.some(
        (repair) =>
          repair.field === "customer" &&
          repair.cleanedValue === "UNKNOWN_CUSTOMER",
      ),
    ).toBe(true);

    expect(
      result.repairs.some(
        (repair) =>
          repair.field === "date" &&
          repair.originalValue === "05/02/26" &&
          repair.cleanedValue === "2026-05-02",
      ),
    ).toBe(true);

    expect(
      result.repairs.some(
        (repair) => repair.field === "quantity" && repair.requiresReview,
      ),
    ).toBe(true);

    expect(
      result.repairs.some(
        (repair) =>
          repair.field === "unit" &&
          repair.cleanedValue === "UNKNOWN_UNIT" &&
          repair.requiresReview,
      ),
    ).toBe(true);

    expect(
      result.anomalies.some(
        (anomaly) =>
          anomaly.field === "date" &&
          anomaly.issue === "Invalid date format" &&
          anomaly.row === 4,
      ),
    ).toBe(true);

    expect(result.validationPassed).toBe(false);
  });

  it("passes validation for the clean AEC ticket sample", async () => {
    const rawData = readTicketCsv(CLEAN_SAMPLE_CSV);
    const result = await runADIWorkflow(rawData);

    expect(result.rawData).toHaveLength(2);
    expect(result.cleanedData).toHaveLength(2);
    expect(result.repairs).toHaveLength(0);
    expect(getUserFacingAnomalies(result.anomalies)).toHaveLength(0);
    expect(result.validationPassed).toBe(true);
    expect(result.healthScore).toBe(100);
  });
});
