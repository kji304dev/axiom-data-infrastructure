import { runADIWorkflow } from "./engine/graph.js";
import type { ADIState, RawTicketRow } from "./types/state.js";

const dirtyTicket1002: RawTicketRow = {
  ticket_id: "1002",
  date: "05/02/26",
  customer: "",
  material: "Gravel",
  quantity: "-4",
  unit: "tons",
  job_site: "",
};

const initialState: Pick<ADIState, "rawData" | "currentStep"> = {
  rawData: [dirtyTicket1002],
  currentStep: "ingest",
};

async function main(): Promise<void> {
  const result = await runADIWorkflow(initialState.rawData);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
