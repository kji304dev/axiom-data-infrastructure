import { resolve } from "node:path";

export const DEFAULT_INPUT = "samples/dirty_aec_ticket.csv";
export const DEFAULT_OUTPUT_DIR = "output";

export interface CliArgs {
  inputPath: string;
  outputDir: string;
}

export interface OutputPaths {
  outputDir: string;
  jsonPath: string;
  markdownPath: string;
}

export function parseCliArgs(argv: string[]): CliArgs {
  let inputPath: string | undefined;
  let outputDir = DEFAULT_OUTPUT_DIR;

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
  };
}

export function resolveOutputPaths(outputDir: string): OutputPaths {
  const resolvedOutputDir = resolve(outputDir);

  return {
    outputDir: resolvedOutputDir,
    jsonPath: resolve(resolvedOutputDir, "langgraph-report.json"),
    markdownPath: resolve(resolvedOutputDir, "clean-vs-dirty-report.md"),
  };
}
