import { basename } from "node:path";
import {
  DEFAULT_RUN_INDEX_PATH,
  readRunIndex,
  type RunIndex,
  type RunIndexEntry,
} from "../io/runIndex.js";

export const NO_RUNS_MESSAGE = "No ADI runs found yet.";

export interface RunSummaryRow {
  runId: string;
  healthScore: number;
  validationPassed: boolean;
  inputBasename: string;
  generatedAt: string;
}

export function toRunSummaryRow(entry: RunIndexEntry): RunSummaryRow {
  return {
    runId: entry.runId,
    healthScore: entry.healthScore,
    validationPassed: entry.validationPassed,
    inputBasename: basename(entry.inputFile),
    generatedAt: entry.generatedAt,
  };
}

export function sortRunsByGeneratedAtDesc(
  runs: RunIndexEntry[],
): RunIndexEntry[] {
  return [...runs].sort(
    (left, right) =>
      Date.parse(right.generatedAt) - Date.parse(left.generatedAt),
  );
}

function padCell(value: string, width: number): string {
  if (value.length >= width) {
    return value.slice(0, width);
  }
  return value.padEnd(width, " ");
}

export function formatRunsSummaryTable(index: RunIndex): string {
  if (index.runs.length === 0) {
    return NO_RUNS_MESSAGE;
  }

  const rows = sortRunsByGeneratedAtDesc(index.runs).map(toRunSummaryRow);
  const headers = [
    "runId",
    "healthScore",
    "validationPassed",
    "input",
    "generatedAt",
  ] as const;

  const stringRows = rows.map((row) => [
    row.runId,
    String(row.healthScore),
    String(row.validationPassed),
    row.inputBasename,
    row.generatedAt,
  ]);

  const widths = headers.map((header, columnIndex) =>
    Math.max(
      header.length,
      ...stringRows.map((row) => row[columnIndex].length),
    ),
  );

  const headerLine = headers
    .map((header, index) => padCell(header, widths[index]))
    .join("  ");
  const separatorLine = widths.map((width) => "-".repeat(width)).join("  ");
  const bodyLines = stringRows.map((row) =>
    row.map((cell, index) => padCell(cell, widths[index])).join("  "),
  );

  return [headerLine, separatorLine, ...bodyLines].join("\n");
}

export function loadRunsSummary(
  indexPath: string = DEFAULT_RUN_INDEX_PATH,
): string {
  const index = readRunIndex(indexPath);

  if (index.runs.length === 0) {
    return NO_RUNS_MESSAGE;
  }

  return formatRunsSummaryTable(index);
}
