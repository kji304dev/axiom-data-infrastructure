import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runADIWorkflow } from "./engine/graph.js";
import {
  parseCliArgs,
  resolveOutputPaths,
  resolveRunOutputDirectory,
} from "./io/cliArgs.js";
import { readTicketCsv } from "./io/csvReader.js";
import { generateMarkdownReport } from "./io/markdownReport.js";
import { attachRunMetadata } from "./io/runMetadata.js";
import { createAndWriteRunManifest } from "./io/runManifest.js";
import { updateRunIndex } from "./io/runIndex.js";
import { summarizeAnomalies } from "./io/anomalies.js";

async function main(): Promise<void> {
  const { inputPath, outputDir: explicitOutputDir } = parseCliArgs(
    process.argv.slice(2),
  );
  const resolvedInputPath = resolve(inputPath);

  const rawData = readTicketCsv(inputPath);
  const workflowResult = await runADIWorkflow(rawData);

  const {
    outputDir: resolvedOutputDir,
    isAutoOutputDir,
    generatedAt,
  } = resolveRunOutputDirectory({
    inputFile: resolvedInputPath,
    explicitOutputDir,
  });

  const result = attachRunMetadata(workflowResult, {
    inputFile: resolvedInputPath,
    outputDirectory: resolvedOutputDir,
    generatedAt,
  });

  const { jsonPath, markdownPath } = resolveOutputPaths(resolvedOutputDir);

  mkdirSync(resolvedOutputDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");

  const markdownReport = generateMarkdownReport({
    inputFilePath: resolvedInputPath,
    result,
  });
  writeFileSync(markdownPath, markdownReport, "utf-8");
  const { manifestPath, manifest } = createAndWriteRunManifest(
    resolvedOutputDir,
    result,
    {
      jsonPath,
      markdownPath,
    },
  );
  const runIndexPath = updateRunIndex(manifest);

  const anomalySummary = summarizeAnomalies(result.anomalies);

  console.log(`Input file: ${resolvedInputPath}`);
  if (isAutoOutputDir) {
    console.log(`Auto-generated output directory: ${resolvedOutputDir}`);
  } else {
    console.log(`Output directory: ${resolvedOutputDir}`);
  }
  console.log(`JSON report saved to: ${jsonPath}`);
  console.log(`Markdown report saved to: ${markdownPath}`);
  console.log(`Manifest saved to: ${manifestPath}`);
  console.log(`Run index updated at: ${runIndexPath}`);
  console.log(`Total rows: ${result.rawData.length}`);
  console.log(`User-facing anomalies: ${anomalySummary.userFacing}`);
  console.log(`Internal anomalies: ${anomalySummary.internal}`);
  console.log(`validationPassed: ${result.validationPassed}`);
  console.log(`healthScore: ${result.healthScore}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
