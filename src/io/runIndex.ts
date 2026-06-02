import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { RunManifest } from "./runManifest.js";

export const DEFAULT_RUN_INDEX_PATH = "output/runs/index.json";

export interface RunIndexEntry {
  runId: string;
  inputFile: string;
  outputDirectory: string;
  manifestPath: string;
  healthScore: number;
  validationPassed: boolean;
  generatedAt: string;
  engineVersion: string;
}

export interface RunIndex {
  runs: RunIndexEntry[];
}

const runIndexEntrySchema = z.object({
  runId: z.string(),
  inputFile: z.string(),
  outputDirectory: z.string(),
  manifestPath: z.string(),
  healthScore: z.number(),
  validationPassed: z.boolean(),
  generatedAt: z.string(),
  engineVersion: z.string(),
});

const runIndexSchema = z.object({
  runs: z.array(runIndexEntrySchema),
});

export function resolveRunIndexPath(
  indexPath: string = DEFAULT_RUN_INDEX_PATH,
): string {
  return resolve(indexPath);
}

export function buildRunIndexEntry(manifest: RunManifest): RunIndexEntry {
  return {
    runId: manifest.runId,
    inputFile: manifest.inputFile,
    outputDirectory: manifest.outputDirectory,
    manifestPath: resolve(manifest.outputDirectory, "manifest.json"),
    healthScore: manifest.healthScore,
    validationPassed: manifest.validationPassed,
    generatedAt: manifest.generatedAt,
    engineVersion: manifest.engineVersion,
  };
}

export function readRunIndex(indexPath: string): RunIndex {
  const absolutePath = resolveRunIndexPath(indexPath);

  if (!existsSync(absolutePath)) {
    return { runs: [] };
  }

  const content = readFileSync(absolutePath, "utf-8");
  return runIndexSchema.parse(JSON.parse(content));
}

export function upsertRunIndexEntry(
  index: RunIndex,
  entry: RunIndexEntry,
): RunIndex {
  const withoutDuplicate = index.runs.filter(
    (existing) => existing.runId !== entry.runId,
  );

  return {
    runs: [...withoutDuplicate, entry],
  };
}

export function writeRunIndex(indexPath: string, index: RunIndex): string {
  const absolutePath = resolveRunIndexPath(indexPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(index, null, 2)}\n`, "utf-8");
  return absolutePath;
}

export function updateRunIndex(
  manifest: RunManifest,
  indexPath: string = DEFAULT_RUN_INDEX_PATH,
): string {
  const entry = buildRunIndexEntry(manifest);
  const currentIndex = readRunIndex(indexPath);
  const updatedIndex = upsertRunIndexEntry(currentIndex, entry);
  return writeRunIndex(indexPath, updatedIndex);
}
