import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTO_RUNS_BASE_DIR,
  DEFAULT_INPUT,
  parseCliArgs,
  resolveAutoRunOutputDir,
  resolveOutputPaths,
  resolveRunOutputDirectory,
} from "../src/io/cliArgs.js";
import { DEFAULT_PROFILE } from "../src/io/profiles.js";

describe("parseCliArgs", () => {
  it("uses defaults when no arguments are provided", () => {
    expect(parseCliArgs([])).toEqual({
      inputPath: DEFAULT_INPUT,
      outputDir: undefined,
      profile: DEFAULT_PROFILE,
    });
  });

  it("parses input path only without explicit output directory", () => {
    expect(parseCliArgs(["samples/dirty_aec_ticket.csv"])).toEqual({
      inputPath: "samples/dirty_aec_ticket.csv",
      outputDir: undefined,
      profile: DEFAULT_PROFILE,
    });
  });

  it("parses explicit --profile aec", () => {
    expect(
      parseCliArgs(["samples/dirty_aec_ticket.csv", "--profile", "aec"]),
    ).toEqual({
      inputPath: "samples/dirty_aec_ticket.csv",
      outputDir: undefined,
      profile: "aec",
    });
  });

  it("throws for unsupported profile values", () => {
    expect(() =>
      parseCliArgs(["samples/dirty_aec_ticket.csv", "--profile", "finance"]),
    ).toThrow("Unsupported profile: finance");
    expect(() =>
      parseCliArgs(["samples/dirty_aec_ticket.csv", "--profile", "finance"]),
    ).toThrow("Supported profiles: aec");
  });

  it("parses input path and --output-dir flag", () => {
    expect(
      parseCliArgs([
        "samples/dirty_aec_ticket.csv",
        "--output-dir",
        "output/runs/dirty-aec-test",
      ]),
    ).toEqual({
      inputPath: "samples/dirty_aec_ticket.csv",
      outputDir: "output/runs/dirty-aec-test",
      profile: DEFAULT_PROFILE,
    });
  });

  it("throws when --output-dir is missing a path", () => {
    expect(() =>
      parseCliArgs(["samples/dirty_aec_ticket.csv", "--output-dir"]),
    ).toThrow("--output-dir requires a path argument");
  });

  it("throws when --profile is missing a value", () => {
    expect(() =>
      parseCliArgs(["samples/dirty_aec_ticket.csv", "--profile"]),
    ).toThrow("--profile requires a profile name");
  });

  it("throws on unknown flags", () => {
    expect(() => parseCliArgs(["--unknown-flag"])).toThrow("Unknown flag");
  });
});

describe("resolveAutoRunOutputDir", () => {
  it("places auto runs under output/runs/<runId>", () => {
    expect(resolveAutoRunOutputDir("20260601T161847Z_dirty_aec_ticket")).toBe(
      resolve(AUTO_RUNS_BASE_DIR, "20260601T161847Z_dirty_aec_ticket"),
    );
  });
});

describe("resolveRunOutputDirectory", () => {
  it("uses an auto-generated directory when --output-dir is omitted", () => {
    const generatedAt = new Date("2026-06-01T16:18:47.000Z");
    const resolved = resolveRunOutputDirectory({
      inputFile: resolve("samples/dirty_aec_ticket.csv"),
      generatedAt,
    });

    expect(resolved.isAutoOutputDir).toBe(true);
    expect(resolved.runId).toBe("20260601T161847Z_dirty_aec_ticket");
    expect(resolved.outputDir).toBe(
      resolve(AUTO_RUNS_BASE_DIR, "20260601T161847Z_dirty_aec_ticket"),
    );
  });

  it("uses the explicit output directory when --output-dir is provided", () => {
    const generatedAt = new Date("2026-06-01T16:18:47.000Z");
    const resolved = resolveRunOutputDirectory({
      inputFile: resolve("samples/dirty_aec_ticket.csv"),
      explicitOutputDir: "output/runs/dirty-aec-test",
      generatedAt,
    });

    expect(resolved.isAutoOutputDir).toBe(false);
    expect(resolved.runId).toBe("20260601T161847Z_dirty_aec_ticket");
    expect(resolved.outputDir).toBe(resolve("output/runs/dirty-aec-test"));
  });
});

describe("resolveOutputPaths", () => {
  it("resolves report paths inside the output directory", () => {
    const paths = resolveOutputPaths("output/runs/dirty-aec-test");

    expect(paths.outputDir).toBe(resolve("output/runs/dirty-aec-test"));
    expect(paths.jsonPath).toBe(
      resolve("output/runs/dirty-aec-test/langgraph-report.json"),
    );
    expect(paths.markdownPath).toBe(
      resolve("output/runs/dirty-aec-test/clean-vs-dirty-report.md"),
    );
    expect(paths.manifestPath).toBe(
      resolve("output/runs/dirty-aec-test/manifest.json"),
    );
  });
});
