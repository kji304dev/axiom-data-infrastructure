import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createRunMetadata } from "../src/io/runMetadata.js";
import { buildRunManifest } from "../src/io/runManifest.js";
import {
  buildRunIndexEntry,
  readRunIndex,
  updateRunIndex,
  upsertRunIndexEntry,
  writeRunIndex,
} from "../src/io/runIndex.js";

function sampleManifest(runId: string) {
  const outputDirectory = resolve("output/runs/dirty-aec-test");
  const runMetadata = createRunMetadata({
    inputFile: resolve("samples/dirty_aec_ticket.csv"),
    outputDirectory,
    generatedAt: new Date("2026-06-01T16:18:47.000Z"),
  });

  return buildRunManifest({
    runMetadata: { ...runMetadata, runId },
    jsonReportPath: resolve(outputDirectory, "langgraph-report.json"),
    markdownReportPath: resolve(outputDirectory, "clean-vs-dirty-report.md"),
    healthScore: 58,
    validationPassed: false,
  });
}

describe("runIndex", () => {
  it("builds a run index entry from a manifest", () => {
    const manifest = sampleManifest("20260601T161847Z_dirty_aec_ticket");

    expect(buildRunIndexEntry(manifest)).toEqual({
      runId: "20260601T161847Z_dirty_aec_ticket",
      inputFile: resolve("samples/dirty_aec_ticket.csv"),
      outputDirectory: resolve("output/runs/dirty-aec-test"),
      manifestPath: resolve("output/runs/dirty-aec-test/manifest.json"),
      healthScore: 58,
      validationPassed: false,
      generatedAt: "2026-06-01T16:18:47.000Z",
      engineVersion: "0.1.0",
    });
  });

  it("returns an empty index when the index file is missing", () => {
    const indexPath = join(
      mkdtempSync(join(tmpdir(), "adi-run-index-missing-")),
      "index.json",
    );

    expect(readRunIndex(indexPath)).toEqual({ runs: [] });
  });

  it("appends new runs and avoids duplicate runId entries", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "adi-run-index-upsert-"));
    const indexPath = join(tempDir, "index.json");
    const firstEntry = buildRunIndexEntry(
      sampleManifest("20260601T161847Z_dirty_aec_ticket"),
    );
    const updatedEntry = {
      ...firstEntry,
      healthScore: 42,
    };
    const secondEntry = buildRunIndexEntry(
      sampleManifest("20260601T170000Z_clean_aec_ticket"),
    );

    writeRunIndex(indexPath, { runs: [firstEntry] });
    const afterUpdate = upsertRunIndexEntry(readRunIndex(indexPath), updatedEntry);
    const afterAppend = upsertRunIndexEntry(afterUpdate, secondEntry);
    writeRunIndex(indexPath, afterAppend);

    const written = readRunIndex(indexPath);
    expect(written.runs).toHaveLength(2);
    expect(written.runs[0]?.runId).toBe("20260601T161847Z_dirty_aec_ticket");
    expect(written.runs[0]?.healthScore).toBe(42);
    expect(written.runs[1]?.runId).toBe("20260601T170000Z_clean_aec_ticket");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("updates the run index file on disk", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "adi-run-index-update-"));
    const indexPath = join(tempDir, "index.json");
    const manifest = sampleManifest("20260601T161847Z_dirty_aec_ticket");

    const writtenPath = updateRunIndex(manifest, indexPath);
    const written = JSON.parse(readFileSync(writtenPath, "utf-8")) as {
      runs: { runId: string }[];
    };

    expect(writtenPath).toBe(resolve(indexPath));
    expect(written.runs).toHaveLength(1);
    expect(written.runs[0]?.runId).toBe("20260601T161847Z_dirty_aec_ticket");

    rmSync(tempDir, { recursive: true, force: true });
  });
});
