import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = resolve(".");
const CLI_ENTRY = join(PROJECT_ROOT, "src/index.ts");

function runCli(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync("npx", ["tsx", CLI_ENTRY, ...args], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, stderr: "", status: 0 };
  } catch (error) {
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };

    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
      status: execError.status ?? 1,
    };
  }
}

describe("CLI input validation", () => {
  it("exits cleanly when the input file is missing", () => {
    const missingPath = resolve("samples/does-not-exist-cli.csv");
    const result = runCli([missingPath, "--profile", "aec"]);

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe(
      `Error: Input file not found: ${missingPath}`,
    );
    expect(result.stderr).not.toContain("at ");
  });

  it("exits cleanly when the CSV is empty", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "adi-cli-empty-"));
    const csvPath = join(tempDir, "empty.csv");
    writeFileSync(csvPath, "", "utf-8");

    const result = runCli([csvPath, "--profile", "aec"]);

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe(
      `Error: Input CSV is empty: ${resolve(csvPath)}`,
    );
    expect(result.stderr).not.toContain("at ");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("exits cleanly when headers cannot map to canonical AEC fields", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "adi-cli-bad-headers-"));
    const csvPath = join(tempDir, "bad-headers.csv");
    writeFileSync(
      csvPath,
      "invoice,when,who\n1,2026-01-01,Acme\n",
      "utf-8",
    );

    const result = runCli([csvPath, "--profile", "aec"]);

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe(
      "Error: Input CSV is missing required mappable fields: ticket_id, date, customer, material, quantity, unit, job_site",
    );
    expect(result.stderr).not.toContain("at ");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("does not write reports when input validation fails", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "adi-cli-no-output-"));
    const csvPath = join(tempDir, "bad.csv");
    const outputDir = join(tempDir, "output");
    writeFileSync(csvPath, "foo,bar\n1,2\n", "utf-8");

    const result = runCli([
      csvPath,
      "--profile",
      "aec",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(1);
    expect(existsSync(outputDir)).toBe(false);
    expect(result.stdout).not.toContain("JSON report saved");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("runs successfully with the canonical and alternate header fixtures", () => {
    for (const fixture of [
      "samples/dirty_aec_ticket.csv",
      "samples/dirty_aec_ticket_alt_headers.csv",
    ]) {
      const tempDir = mkdtempSync(join(tmpdir(), "adi-cli-success-"));
      const outputDir = join(tempDir, "output");

      const result = runCli([
        fixture,
        "--profile",
        "aec",
        "--output-dir",
        outputDir,
      ]);

      expect(result.status).toBe(0);
      expect(readdirSync(outputDir).sort()).toEqual([
        "clean-vs-dirty-report.md",
        "langgraph-report.json",
        "manifest.json",
      ]);

      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
