import { describe, expect, it } from "vitest";
import { runADIWorkflow } from "../src/engine/graph.js";
import { readTicketCsv } from "../src/io/csvReader.js";

describe("alternate header fixture workflow", () => {
  it("produces the same cleaning outcome as the canonical-header sample", async () => {
    const canonicalRows = readTicketCsv("samples/dirty_aec_ticket.csv");
    const alternateRows = readTicketCsv(
      "samples/dirty_aec_ticket_alt_headers.csv",
    );

    expect(alternateRows).toEqual(canonicalRows);

    const canonicalResult = await runADIWorkflow(canonicalRows);
    const alternateResult = await runADIWorkflow(alternateRows);

    expect(alternateResult.rawData).toEqual(canonicalResult.rawData);
    expect(alternateResult.cleanedData).toEqual(canonicalResult.cleanedData);
    expect(alternateResult.healthScore).toBe(canonicalResult.healthScore);
    expect(alternateResult.validationPassed).toBe(
      canonicalResult.validationPassed,
    );
  });
});
