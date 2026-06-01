import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRunId,
  createRunMetadata,
  readEngineVersion,
  sanitizeInputBaseName,
} from "../src/io/runMetadata.js";

describe("runMetadata", () => {
  it("reads engine version from package.json", () => {
    expect(readEngineVersion()).toBe("0.1.0");
  });

  it("sanitizes input file base names for run IDs", () => {
    expect(sanitizeInputBaseName("samples/dirty_aec_ticket.csv")).toBe(
      "dirty_aec_ticket",
    );
  });

  it("builds a run ID from timestamp and sanitized input name", () => {
    const generatedAt = new Date("2026-06-01T16:18:47.000Z");

    expect(
      buildRunId("samples/dirty_aec_ticket.csv", generatedAt),
    ).toBe("20260601T161847Z_dirty_aec_ticket");
  });

  it("creates run metadata with input file and engine version", () => {
    const generatedAt = new Date("2026-06-01T16:18:47.000Z");
    const metadata = createRunMetadata({
      inputFile: resolve("samples/dirty_aec_ticket.csv"),
      outputDirectory: resolve("output/runs/dirty-aec-test"),
      generatedAt,
    });

    expect(metadata.inputFile).toBe(resolve("samples/dirty_aec_ticket.csv"));
    expect(metadata.outputDirectory).toBe(
      resolve("output/runs/dirty-aec-test"),
    );
    expect(metadata.engineVersion).toBe("0.1.0");
    expect(metadata.generatedAt).toBe("2026-06-01T16:18:47.000Z");
    expect(metadata.runId).toBe("20260601T161847Z_dirty_aec_ticket");
  });
});
