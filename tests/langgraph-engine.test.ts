import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runADIWorkflow } from "../src/engine/graph.js";
import { getRowStatus } from "../src/agents/rowStatus.js";
import { getOperatorDecision } from "../src/agents/operatorDecision.js";
import { getFinalOperatorDecision } from "../src/io/operatorOverrides.js";
import { attachRunMetadata } from "../src/io/runMetadata.js";
import { getUserFacingAnomalies } from "../src/io/anomalies.js";
import { readTicketCsv } from "../src/io/csvReader.js";
import type { RecommendedDecision, RowStatusKind } from "../src/types/state.js";

const DIRTY_SAMPLE_CSV = resolve("samples/dirty_aec_ticket.csv");
const CLEAN_SAMPLE_CSV = resolve("samples/clean_aec_ticket.csv");
const UNRECOVERABLE_SAMPLE_CSV = resolve("samples/unrecoverable_aec_ticket.csv");
const NO_OVERRIDES_PATH = resolve("operator/no-overrides-for-tests.json");
const OPERATOR_OVERRIDES_PATH = resolve("operator/decisions.json");
const DEFAULT_OUTPUT_DIR = "output";

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

function expectFinalOperatorDecision(
  finalDecisions: {
    row: number;
    finalDecision: RecommendedDecision;
  }[],
  csvRow: number,
  expectedDecision: RecommendedDecision,
): void {
  const decision = getFinalOperatorDecision(finalDecisions, csvRow);
  expect(decision?.finalDecision).toBe(expectedDecision);
}

async function runWorkflowWithMetadata(
  inputCsv: string,
  outputDir: string,
  operatorOverridesPath?: string,
) {
  const resolvedInput = resolve(inputCsv);
  const resolvedOutput = resolve(outputDir);
  const rawData = readTicketCsv(inputCsv);
  const workflowResult = await runADIWorkflow(rawData, operatorOverridesPath);

  return attachRunMetadata(workflowResult, {
    inputFile: resolvedInput,
    outputDirectory: resolvedOutput,
  });
}

function expectRunMetadata(
  result: { runMetadata?: { inputFile: string; engineVersion: string } },
  inputFile: string,
): void {
  expect(result.runMetadata).toBeDefined();
  expect(result.runMetadata?.inputFile).toBe(resolve(inputFile));
  expect(result.runMetadata?.engineVersion).toBe("0.1.0");
}

describe("LangGraph ADI engine", () => {
  it("cleans the dirty AEC ticket sample while preserving raw data", async () => {
    const rawData = readTicketCsv(DIRTY_SAMPLE_CSV);
    const result = await runWorkflowWithMetadata(
      DIRTY_SAMPLE_CSV,
      DEFAULT_OUTPUT_DIR,
      OPERATOR_OVERRIDES_PATH,
    );

    expectRunMetadata(result, DIRTY_SAMPLE_CSV);

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

    expect(result.finalOperatorDecisions).toHaveLength(4);
    expectOperatorDecision(result.operatorDecisions, 3, "needs_customer_input");
    const row3Final = getFinalOperatorDecision(result.finalOperatorDecisions, 3);
    expect(row3Final?.finalDecision).toBe("approved_with_changes");
    expect(row3Final?.operatorNote).toContain("dispatch team");
    expectFinalOperatorDecision(result.finalOperatorDecisions, 2, "approved");
    expectFinalOperatorDecision(result.finalOperatorDecisions, 4, "rejected");
    expectFinalOperatorDecision(result.finalOperatorDecisions, 5, "approved");
  });

  it("passes validation for the clean AEC ticket sample", async () => {
    const result = await runWorkflowWithMetadata(
      CLEAN_SAMPLE_CSV,
      DEFAULT_OUTPUT_DIR,
      NO_OVERRIDES_PATH,
    );

    expectRunMetadata(result, CLEAN_SAMPLE_CSV);

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

    expect(result.finalOperatorDecisions).toHaveLength(2);
    expectFinalOperatorDecision(result.finalOperatorDecisions, 2, "approved");
    expectFinalOperatorDecision(result.finalOperatorDecisions, 3, "approved");
  });

  it("handles unrecoverable AEC ticket data without throwing", async () => {
    const rawData = readTicketCsv(UNRECOVERABLE_SAMPLE_CSV);
    const result = await runWorkflowWithMetadata(
      UNRECOVERABLE_SAMPLE_CSV,
      DEFAULT_OUTPUT_DIR,
      NO_OVERRIDES_PATH,
    );

    expectRunMetadata(result, UNRECOVERABLE_SAMPLE_CSV);

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

    expect(result.finalOperatorDecisions).toHaveLength(2);
    expectFinalOperatorDecision(result.finalOperatorDecisions, 2, "rejected");
    expectFinalOperatorDecision(result.finalOperatorDecisions, 3, "rejected");
  });
});
