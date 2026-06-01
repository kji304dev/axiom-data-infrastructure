import { buildHealthScoreBreakdown } from "../agents/grader.js";
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

function formatDeduction(amount: number): string {
  return amount === 0 ? "0" : `−${amount}`;
}

function buildRunMetadataSection(result: ADIGraphState): string[] {
  const metadata = result.runMetadata;

  if (!metadata) {
    return [];
  }

  return [
    "## Run Metadata",
    "",
    `- **Run ID:** ${escapeTableCell(metadata.runId)}`,
    `- **Input file:** ${escapeTableCell(metadata.inputFile)}`,
    `- **Output directory:** ${escapeTableCell(metadata.outputDirectory)}`,
    `- **Generated at:** ${escapeTableCell(metadata.generatedAt)}`,
    `- **Engine version:** ${escapeTableCell(metadata.engineVersion)}`,
    "",
  ];
}

function buildHealthScoreExplanationSection(result: ADIGraphState): string[] {
  const breakdown = buildHealthScoreBreakdown(result);

  return [
    "## Health Score Explanation",
    "",
    `- **Starting score:** ${breakdown.startingScore}`,
    `- **High-severity anomalies:** ${breakdown.highAnomalyCount} (${formatDeduction(breakdown.highAnomalyDeduction)})`,
    `- **Medium-severity anomalies:** ${breakdown.mediumAnomalyCount} (${formatDeduction(breakdown.mediumAnomalyDeduction)})`,
    `- **Repairs requiring review:** ${breakdown.reviewRepairCount} (${formatDeduction(breakdown.reviewRepairDeduction)})`,
    `- **Confident repairs:** ${breakdown.confidentRepairCount} (${formatDeduction(breakdown.confidentRepairDeduction)})`,
    `- **Final health score:** ${breakdown.finalScore}`,
    "",
  ];
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
  const healthScore =
    result.healthScore ?? buildHealthScoreBreakdown(result).finalScore;

  const lines: string[] = [
    "# ADI Clean vs Dirty Report",
    "",
    ...buildRunMetadataSection(result),
    "## Summary",
    "",
    `- **Input file:** ${escapeTableCell(inputFilePath)}`,
    `- **Total rows:** ${result.rawData.length}`,
    `- **Health score:** ${healthScore}`,
    `- **validationPassed:** ${result.validationPassed ?? false}`,
    `- **Total anomalies:** ${userFacingAnomalies.length}`,
    `- **Total repairs:** ${result.repairs.length}`,
    `- **Repairs requiring review:** ${repairsRequiringReview}`,
    "",
    ...buildHealthScoreExplanationSection(result),
    "## Row Statuses",
    "",
  ];

  if (result.rowStatuses.length === 0) {
    lines.push("_No row statuses recorded._", "");
  } else {
    lines.push(
      buildTable(
        ["row", "status", "reason"],
        result.rowStatuses.map((rowStatus) => [
          String(rowStatus.row),
          formatCell(rowStatus.status),
          formatCell(rowStatus.reason),
        ]),
      ),
      "",
    );
  }

  lines.push("## Operator Decisions", "");

  if (result.operatorDecisions.length === 0) {
    lines.push("_No operator decisions recorded._", "");
  } else {
    lines.push(
      buildTable(
        ["row", "recommendedDecision", "reason"],
        result.operatorDecisions.map((decision) => [
          String(decision.row),
          formatCell(decision.recommendedDecision),
          formatCell(decision.reason),
        ]),
      ),
      "",
    );
  }

  lines.push("## Final Operator Decisions", "");

  if (result.finalOperatorDecisions.length === 0) {
    lines.push("_No final operator decisions recorded._", "");
  } else {
    lines.push(
      buildTable(
        ["row", "recommendedDecision", "finalDecision", "operatorNote"],
        result.finalOperatorDecisions.map((decision) => [
          String(decision.row),
          formatCell(decision.recommendedDecision),
          formatCell(decision.finalDecision),
          formatCell(decision.operatorNote),
        ]),
      ),
      "",
    );
  }

  lines.push("## Repairs", "");

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
