import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runADIWorkflow } from "../src/engine/graph.js";
import { getRowStatus } from "../src/agents/rowStatus.js";
import { getOperatorDecision } from "../src/agents/operatorDecision.js";
import { readTicketCsv } from "../src/io/csvReader.js";
import type { Anomaly, RecommendedDecision, RowStatusKind } from "../src/types/state.js";

const DIRTY_SAMPLE_CSV = resolve("samples/dirty_aec_ticket.csv");
const CLEAN_SAMPLE_CSV = resolve("samples/clean_aec_ticket.csv");
const UNRECOVERABLE_SAMPLE_CSV = resolve("samples/unrecoverable_aec_ticket.csv");

function getUserFacingAnomalies(anomalies: Anomaly[]): Anomaly[] {
  return anomalies.filter((anomaly) => anomaly.field !== "cleanedData");
}

function expectRowStatus(
  rowStatuses: { row: number; status: RowStatusKind }[],
  csvRow: number,
  expectedStatus: RowStatusKind,
): void {
  const rowStatus = getRowStatus(rowStatuses, csvRow);
  expect(rowStatus?.status).toBe(expectedStatus);
}

function expectOperatorDecision(
  operatorDecisions: { row: number; recommendedDecision: RecommendedDecision }[],
  csvRow: number,
  expectedDecision: RecommendedDecision,
): void {
  const decision = getOperatorDecision(operatorDecisions, csvRow);
  expect(decision?.recommendedDecision).toBe(expectedDecision);
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
    expect(result.healthScore).toBeLessThan(80);
    expect(result.healthScore).toBe(58);

    expect(result.rowStatuses).toHaveLength(4);
    expectRowStatus(result.rowStatuses, 2, "clean");
    expectRowStatus(result.rowStatuses, 3, "needs_review");
    expectRowStatus(result.rowStatuses, 4, "rejected");
    expectRowStatus(result.rowStatuses, 5, "clean");

    expect(result.operatorDecisions).toHaveLength(4);
    expectOperatorDecision(result.operatorDecisions, 2, "approved");
    expectOperatorDecision(result.operatorDecisions, 3, "needs_customer_input");
    expectOperatorDecision(result.operatorDecisions, 4, "rejected");
    expectOperatorDecision(result.operatorDecisions, 5, "approved");
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

    expect(result.rowStatuses).toHaveLength(2);
    expectRowStatus(result.rowStatuses, 2, "clean");
    expectRowStatus(result.rowStatuses, 3, "clean");

    expect(result.operatorDecisions).toHaveLength(2);
    expectOperatorDecision(result.operatorDecisions, 2, "approved");
    expectOperatorDecision(result.operatorDecisions, 3, "approved");
  });

  it("handles unrecoverable AEC ticket data without throwing", async () => {
    const rawData = readTicketCsv(UNRECOVERABLE_SAMPLE_CSV);
    const result = await runADIWorkflow(rawData);

    expect(result.rawData).toEqual(rawData);
    expect(result.validationPassed).toBe(false);
    expect(result.healthScore).toBeLessThan(60);
    expect(result.healthScore).toBe(25);

    expect(
      result.anomalies.some(
        (anomaly) =>
          anomaly.field === "date" && anomaly.issue === "Invalid date format",
      ),
    ).toBe(true);

    expect(
      result.anomalies.some(
        (anomaly) =>
          anomaly.field === "quantity" ||
          anomaly.field === "cleanedData",
      ),
    ).toBe(true);

    expect(
      result.repairs.some(
        (repair) => repair.requiresReview,
      ),
    ).toBe(true);

    expect(
      result.repairs.some(
        (repair) =>
          repair.requiresReview &&
          (repair.cleanedValue === "UNKNOWN_CUSTOMER" ||
            repair.cleanedValue === "UNASSIGNED" ||
            repair.cleanedValue === "UNKNOWN_UNIT"),
      ),
    ).toBe(true);

    expect(result.rowStatuses).toHaveLength(2);
    expectRowStatus(result.rowStatuses, 2, "rejected");
    expectRowStatus(result.rowStatuses, 3, "rejected");

    expect(result.operatorDecisions).toHaveLength(2);
    expectOperatorDecision(result.operatorDecisions, 2, "rejected");
    expectOperatorDecision(result.operatorDecisions, 3, "rejected");
  });
});
