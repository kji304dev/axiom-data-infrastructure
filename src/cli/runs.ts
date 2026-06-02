import { existsSync } from "node:fs";
import {
  DEFAULT_RUN_INDEX_PATH,
  resolveRunIndexPath,
} from "../io/runIndex.js";
import { loadRunsSummary, NO_RUNS_MESSAGE } from "../io/runSummary.js";

function main(): void {
  const indexPath = resolveRunIndexPath(DEFAULT_RUN_INDEX_PATH);

  if (!existsSync(indexPath)) {
    console.log(NO_RUNS_MESSAGE);
    return;
  }

  console.log(loadRunsSummary(indexPath));
}

main();
