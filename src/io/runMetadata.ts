import { readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ADIGraphState, RunMetadata } from "../types/state.js";
import { DEFAULT_PROFILE, type DataProfile } from "./profiles.js";

const PACKAGE_JSON_PATH = resolve(
  fileURLToPath(new URL("../../package.json", import.meta.url)),
);

export interface CreateRunMetadataOptions {
  inputFile: string;
  outputDirectory: string;
  profile?: DataProfile;
  generatedAt?: Date;
}

export function readEngineVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(PACKAGE_JSON_PATH, "utf-8"),
    ) as { version?: string };
    return packageJson.version ?? "0.1.0";
  } catch {
    return "0.1.0";
  }
}

export function sanitizeInputBaseName(inputFile: string): string {
  const baseName = basename(inputFile, extname(inputFile));
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || "input";
}

export function formatRunTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildRunId(inputFile: string, generatedAt: Date): string {
  const timestamp = formatRunTimestamp(generatedAt);
  const inputSlug = sanitizeInputBaseName(inputFile);
  return `${timestamp}_${inputSlug}`;
}

export function createRunMetadata(
  options: CreateRunMetadataOptions,
): RunMetadata {
  const generatedAt = options.generatedAt ?? new Date();

  return {
    runId: buildRunId(options.inputFile, generatedAt),
    inputFile: options.inputFile,
    outputDirectory: options.outputDirectory,
    generatedAt: generatedAt.toISOString(),
    engineVersion: readEngineVersion(),
    profile: options.profile ?? DEFAULT_PROFILE,
  };
}

export function attachRunMetadata(
  state: ADIGraphState,
  options: CreateRunMetadataOptions,
): ADIGraphState {
  return {
    ...state,
    runMetadata: createRunMetadata(options),
  };
}
