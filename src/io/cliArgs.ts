import { resolve } from "node:path";
import { buildRunId } from "./runMetadata.js";
import { DEFAULT_PROFILE, parseProfile, type DataProfile } from "./profiles.js";

export const DEFAULT_INPUT = "samples/dirty_aec_ticket.csv";
export const AUTO_RUNS_BASE_DIR = "output/runs";

export interface CliArgs {
  inputPath: string;
  outputDir?: string;
  profile: DataProfile;
}

export interface OutputPaths {
  outputDir: string;
  jsonPath: string;
  markdownPath: string;
  manifestPath: string;
}

export interface ResolvedRunOutput {
  outputDir: string;
  runId: string;
  isAutoOutputDir: boolean;
  generatedAt: Date;
}

export function parseCliArgs(argv: string[]): CliArgs {
  let inputPath: string | undefined;
  let outputDir: string | undefined;
  let profile: DataProfile = DEFAULT_PROFILE;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--output-dir") {
      const outputDirValue = argv[index + 1];
      if (!outputDirValue || outputDirValue.startsWith("--")) {
        throw new Error("--output-dir requires a path argument");
      }
      outputDir = outputDirValue;
      index += 1;
      continue;
    }

    if (arg === "--profile") {
      const profileValue = argv[index + 1];
      if (!profileValue || profileValue.startsWith("--")) {
        throw new Error("--profile requires a profile name");
      }
      profile = parseProfile(profileValue);
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    if (!inputPath) {
      inputPath = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return {
    inputPath: inputPath ?? DEFAULT_INPUT,
    outputDir,
    profile,
  };
}

export function resolveAutoRunOutputDir(runId: string): string {
  return resolve(AUTO_RUNS_BASE_DIR, runId);
}

export function resolveRunOutputDirectory(options: {
  inputFile: string;
  explicitOutputDir?: string;
  generatedAt?: Date;
}): ResolvedRunOutput {
  const generatedAt = options.generatedAt ?? new Date();
  const runId = buildRunId(options.inputFile, generatedAt);

  if (options.explicitOutputDir) {
    return {
      outputDir: resolve(options.explicitOutputDir),
      runId,
      isAutoOutputDir: false,
      generatedAt,
    };
  }

  return {
    outputDir: resolveAutoRunOutputDir(runId),
    runId,
    isAutoOutputDir: true,
    generatedAt,
  };
}

export function resolveOutputPaths(outputDir: string): OutputPaths {
  const resolvedOutputDir = resolve(outputDir);

  return {
    outputDir: resolvedOutputDir,
    jsonPath: resolve(resolvedOutputDir, "langgraph-report.json"),
    markdownPath: resolve(resolvedOutputDir, "clean-vs-dirty-report.md"),
    manifestPath: resolve(resolvedOutputDir, "manifest.json"),
  };
}
