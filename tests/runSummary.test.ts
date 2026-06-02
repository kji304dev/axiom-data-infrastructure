import { describe, expect, it } from "vitest";
import type { RunIndex } from "../src/io/runIndex.js";
import {
  formatRunsSummaryTable,
  NO_RUNS_MESSAGE,
  sortRunsByGeneratedAtDesc,
  toRunSummaryRow,
} from "../src/io/runSummary.js";

const sampleIndex: RunIndex = {
  runs: [
    {
      runId: "20260602T001142Z_dirty_aec_ticket",
      inputFile: "/tmp/samples/dirty_aec_ticket.csv",
      outputDirectory: "/tmp/output/runs/one",
      manifestPath: "/tmp/output/runs/one/manifest.json",
      healthScore: 58,
      validationPassed: false,
      generatedAt: "2026-06-02T00:11:42.849Z",
      engineVersion: "0.1.0",
    },
    {
      runId: "20260602T001158Z_clean_aec_ticket",
      inputFile: "/tmp/samples/clean_aec_ticket.csv",
      outputDirectory: "/tmp/output/runs/two",
      manifestPath: "/tmp/output/runs/two/manifest.json",
      healthScore: 100,
      validationPassed: true,
      generatedAt: "2026-06-02T00:11:58.014Z",
      engineVersion: "0.1.0",
    },
  ],
};

describe("runSummary", () => {
  it("maps index entries to summary rows with input basename", () => {
    expect(toRunSummaryRow(sampleIndex.runs[0])).toEqual({
      runId: "20260602T001142Z_dirty_aec_ticket",
      healthScore: 58,
      validationPassed: false,
      inputBasename: "dirty_aec_ticket.csv",
      generatedAt: "2026-06-02T00:11:42.849Z",
    });
  });

  it("sorts runs newest first", () => {
    const sorted = sortRunsByGeneratedAtDesc(sampleIndex.runs);
    expect(sorted[0]?.runId).toBe("20260602T001158Z_clean_aec_ticket");
    expect(sorted[1]?.runId).toBe("20260602T001142Z_dirty_aec_ticket");
  });

  it("formats a readable summary table", () => {
    const table = formatRunsSummaryTable(sampleIndex);

    expect(table).toContain("runId");
    expect(table).toContain("healthScore");
    expect(table).toContain("validationPassed");
    expect(table).toContain("generatedAt");
    expect(table).toContain("20260602T001158Z_clean_aec_ticket");
    expect(table).toContain("dirty_aec_ticket.csv");
    expect(table).toContain("100");
    expect(table.indexOf("20260602T001158Z_clean_aec_ticket")).toBeLessThan(
      table.indexOf("20260602T001142Z_dirty_aec_ticket"),
    );
  });

  it("returns a friendly message when there are no runs", () => {
    expect(formatRunsSummaryTable({ runs: [] })).toBe(NO_RUNS_MESSAGE);
  });
});
