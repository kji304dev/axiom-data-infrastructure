import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runADIWorkflow } from "./engine/graph.js";
import { readTicketCsv } from "./io/csvReader.js";
import { generateMarkdownReport } from "./io/markdownReport.js";

const DEFAULT_INPUT = "samples/dirty_aec_ticket.csv";
const JSON_OUTPUT = "output/langgraph-report.json";
const MARKDOWN_OUTPUT = "output/clean-vs-dirty-report.md";

async function main(): Promise<void> {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT;
  const resolvedInputPath = resolve(inputPath);
  const jsonOutputPath = resolve(JSON_OUTPUT);
  const markdownOutputPath = resolve(MARKDOWN_OUTPUT);

  const rawData = readTicketCsv(inputPath);
  const result = await runADIWorkflow(rawData);

  mkdirSync(dirname(jsonOutputPath), { recursive: true });
  writeFileSync(jsonOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");

  const markdownReport = generateMarkdownReport({
    inputFilePath: resolvedInputPath,
    result,
  });
  writeFileSync(markdownOutputPath, markdownReport, "utf-8");

  console.log(`Input file: ${resolvedInputPath}`);
  console.log(`JSON report saved to: ${jsonOutputPath}`);
  console.log(`Markdown report saved to: ${markdownOutputPath}`);
  console.log(`Total rows: ${result.rawData.length}`);
  console.log(`Anomaly count: ${result.anomalies.length}`);
  console.log(`validationPassed: ${result.validationPassed}`);
  console.log(`healthScore: ${result.healthScore}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
