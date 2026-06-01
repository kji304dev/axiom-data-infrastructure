import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRunManifest,
  createAndWriteRunManifest,
  resolveManifestPath,
} from "../src/io/runManifest.js";
import { createRunMetadata } from "../src/io/runMetadata.js";
import type { ADIGraphState } from "../src/types/state.js";

describe("runManifest", () => {
  it("builds a manifest from runMetadata and report paths", () => {
    const outputDirectory = resolve("output/runs/dirty-aec-test");
    const runMetadata = createRunMetadata({
      inputFile: resolve("samples/dirty_aec_ticket.csv"),
      outputDirectory,
      generatedAt: new Date("2026-06-01T16:18:47.000Z"),
    });
    const jsonReportPath = resolve(outputDirectory, "langgraph-report.json");
    const markdownReportPath = resolve(
      outputDirectory,
      "clean-vs-dirty-report.md",
    );

    const manifest = buildRunManifest({
      runMetadata,
      jsonReportPath,
      markdownReportPath,
      healthScore: 58,
      validationPassed: false,
    });

    expect(manifest).toEqual({
      runId: "20260601T161847Z_dirty_aec_ticket",
      inputFile: resolve("samples/dirty_aec_ticket.csv"),
      outputDirectory,
      jsonReportPath,
      markdownReportPath,
      healthScore: 58,
      validationPassed: false,
      generatedAt: "2026-06-01T16:18:47.000Z",
      engineVersion: "0.1.0",
    });
  });

  it("writes manifest.json into the output directory", () => {
    const outputDirectory = mkdtempSync(join(tmpdir(), "adi-manifest-"));
    const jsonPath = resolve(outputDirectory, "langgraph-report.json");
    const markdownPath = resolve(outputDirectory, "clean-vs-dirty-report.md");

    const state = {
      runMetadata: createRunMetadata({
        inputFile: resolve("samples/dirty_aec_ticket.csv"),
        outputDirectory,
        generatedAt: new Date("2026-06-01T16:18:47.000Z"),
      }),
      healthScore: 58,
      validationPassed: false,
    } as ADIGraphState;

    const manifestPath = createAndWriteRunManifest(outputDirectory, state, {
      jsonPath,
      markdownPath,
    });

    expect(manifestPath).toBe(resolveManifestPath(outputDirectory));

    const written = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      runId: string;
      healthScore: number;
      validationPassed: boolean;
      jsonReportPath: string;
    };

    expect(written.runId).toBe("20260601T161847Z_dirty_aec_ticket");
    expect(written.healthScore).toBe(58);
    expect(written.validationPassed).toBe(false);
    expect(written.jsonReportPath).toBe(jsonPath);
  });
});
