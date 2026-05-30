import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runADIWorkflow } from "./engine/graph.js";
import { readTicketCsv } from "./io/csvReader.js";

const DEFAULT_INPUT = "samples/dirty_aec_ticket.csv";
const DEFAULT_OUTPUT = "output/langgraph-report.json";

async function main(): Promise<void> {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT;
  const outputPath = resolve(DEFAULT_OUTPUT);

  const rawData = readTicketCsv(inputPath);
  const result = await runADIWorkflow(rawData);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");

  console.log(`Input file: ${resolve(inputPath)}`);
  console.log(`Report saved to: ${outputPath}`);
  console.log(`Total rows: ${result.rawData.length}`);
  console.log(`Anomaly count: ${result.anomalies.length}`);
  console.log(`validationPassed: ${result.validationPassed}`);
  console.log(`healthScore: ${result.healthScore}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
