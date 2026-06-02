import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ADIGraphState, RunMetadata } from "../types/state.js";

export interface RunManifest {
  runId: string;
  inputFile: string;
  outputDirectory: string;
  jsonReportPath: string;
  markdownReportPath: string;
  healthScore: number;
  validationPassed: boolean;
  generatedAt: string;
  engineVersion: string;
  profile: string;
}

export interface BuildRunManifestOptions {
  runMetadata: RunMetadata;
  jsonReportPath: string;
  markdownReportPath: string;
  healthScore?: number;
  validationPassed?: boolean;
}

export function buildRunManifest(
  options: BuildRunManifestOptions,
): RunManifest {
  const { runMetadata, jsonReportPath, markdownReportPath } = options;

  return {
    runId: runMetadata.runId,
    inputFile: runMetadata.inputFile,
    outputDirectory: runMetadata.outputDirectory,
    jsonReportPath,
    markdownReportPath,
    healthScore: options.healthScore ?? 0,
    validationPassed: options.validationPassed ?? false,
    generatedAt: runMetadata.generatedAt,
    engineVersion: runMetadata.engineVersion,
    profile: runMetadata.profile,
  };
}

export function resolveManifestPath(outputDirectory: string): string {
  return resolve(outputDirectory, "manifest.json");
}

export function writeRunManifest(
  manifestPath: string,
  manifest: RunManifest,
): void {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

export function createAndWriteRunManifest(
  outputDirectory: string,
  state: ADIGraphState,
  reportPaths: { jsonPath: string; markdownPath: string },
): { manifestPath: string; manifest: RunManifest } {
  if (!state.runMetadata) {
    throw new Error("runMetadata is required to write manifest.json");
  }

  const manifestPath = resolveManifestPath(outputDirectory);
  const manifest = buildRunManifest({
    runMetadata: state.runMetadata,
    jsonReportPath: reportPaths.jsonPath,
    markdownReportPath: reportPaths.markdownPath,
    healthScore: state.healthScore,
    validationPassed: state.validationPassed,
  });

  writeRunManifest(manifestPath, manifest);
  return { manifestPath, manifest };
}
