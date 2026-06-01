import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_INPUT,
  DEFAULT_OUTPUT_DIR,
  parseCliArgs,
  resolveOutputPaths,
} from "../src/io/cliArgs.js";

describe("parseCliArgs", () => {
  it("uses defaults when no arguments are provided", () => {
    expect(parseCliArgs([])).toEqual({
      inputPath: DEFAULT_INPUT,
      outputDir: DEFAULT_OUTPUT_DIR,
    });
  });

  it("parses input path only", () => {
    expect(parseCliArgs(["samples/dirty_aec_ticket.csv"])).toEqual({
      inputPath: "samples/dirty_aec_ticket.csv",
      outputDir: DEFAULT_OUTPUT_DIR,
    });
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
    });
  });

  it("throws when --output-dir is missing a path", () => {
    expect(() =>
      parseCliArgs(["samples/dirty_aec_ticket.csv", "--output-dir"]),
    ).toThrow("--output-dir requires a path argument");
  });

  it("throws on unknown flags", () => {
    expect(() => parseCliArgs(["--unknown-flag"])).toThrow("Unknown flag");
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
  });
});
