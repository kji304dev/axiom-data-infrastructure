import type { ADIGraphState, Anomaly } from "../types/state.js";

export interface MarkdownReportOptions {
  inputFilePath: string;
  result: ADIGraphState;
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatCell(value: string | number | boolean | undefined): string {
  if (value === undefined || value === "") {
    return "(empty)";
  }
  return escapeTableCell(String(value));
}

function buildTable(headers: string[], rows: string[][]): string {
  const headerRow = `| ${headers.join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyRows = rows.map((row) => `| ${row.join(" | ")} |`);
  return [headerRow, separatorRow, ...bodyRows].join("\n");
}

function isUserFacingAnomaly(anomaly: Anomaly): boolean {
  return anomaly.field !== "cleanedData";
}

function csvRowToIndex(csvRow: number): number {
  return csvRow - 2;
}

function getRawFieldValue(
  rawData: ADIGraphState["rawData"],
  csvRow: number,
  field: string,
): string {
  const index = csvRowToIndex(csvRow);
  if (index < 0 || index >= rawData.length) {
    return "";
  }
  return (rawData[index][field] ?? "").trim();
}

function formatUserFacingIssue(
  anomaly: Anomaly,
  rawData: ADIGraphState["rawData"],
): string {
  if (anomaly.field === "date" && anomaly.issue === "Invalid date format") {
    const originalValue = getRawFieldValue(rawData, anomaly.row, "date");
    return `Could not convert "${originalValue || "(empty)"}" into YYYY-MM-DD format`;
  }

  return anomaly.issue;
}

function getUserFacingAnomalies(result: ADIGraphState): Anomaly[] {
  return result.anomalies.filter(isUserFacingAnomaly);
}

export function generateMarkdownReport(
  options: MarkdownReportOptions,
): string {
  const { inputFilePath, result } = options;
  const userFacingAnomalies = getUserFacingAnomalies(result);
  const repairsRequiringReview = result.repairs.filter(
    (repair) => repair.requiresReview,
  ).length;

  const lines: string[] = [
    "# ADI Clean vs Dirty Report",
    "",
    "## Summary",
    "",
    `- **Input file:** ${escapeTableCell(inputFilePath)}`,
    `- **Total rows:** ${result.rawData.length}`,
    `- **Health score:** ${result.healthScore ?? "N/A"}`,
    `- **validationPassed:** ${result.validationPassed ?? false}`,
    `- **Total anomalies:** ${userFacingAnomalies.length}`,
    `- **Total repairs:** ${result.repairs.length}`,
    `- **Repairs requiring review:** ${repairsRequiringReview}`,
    "",
    "## Repairs",
    "",
  ];

  if (result.repairs.length === 0) {
    lines.push("_No repairs recorded._", "");
  } else {
    lines.push(
      buildTable(
        [
          "row",
          "field",
          "originalValue",
          "cleanedValue",
          "confidence",
          "requiresReview",
          "actionTaken",
        ],
        result.repairs.map((repair) => [
          String(repair.row),
          formatCell(repair.field),
          formatCell(repair.originalValue),
          formatCell(repair.cleanedValue),
          String(repair.confidence),
          String(repair.requiresReview),
          formatCell(repair.actionTaken),
        ]),
      ),
      "",
    );
  }

  lines.push("## Anomalies", "");

  if (userFacingAnomalies.length === 0) {
    lines.push("_No anomalies recorded._", "");
  } else {
    lines.push(
      buildTable(
        ["row", "field", "severity", "issue"],
        userFacingAnomalies.map((anomaly) => [
          String(anomaly.row),
          formatCell(anomaly.field),
          formatCell(anomaly.severity),
          formatCell(formatUserFacingIssue(anomaly, result.rawData)),
        ]),
      ),
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}
