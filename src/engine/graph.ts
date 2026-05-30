import { END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { cleanerNode } from "../agents/cleaner.js";
import { graderNode } from "../agents/grader.js";
import {
  ADIStateAnnotation,
  type ADIGraphState,
  type ADIStateUpdate,
  type AecTicketRecord,
} from "../types/state.js";

export const MAX_CLEAN_ATTEMPTS = 3;

export const aecTicketRecordSchema = z.object({
  ticket_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be ISO YYYY-MM-DD"),
  customer: z.string().min(1),
  material: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  job_site: z.string().min(1),
});

export const cleanedDataSchema = z.array(aecTicketRecordSchema);

export type StructuralValidationResult = {
  passed: boolean;
  errors: string[];
};

export function runStructuralValidation(
  records: AecTicketRecord[],
): StructuralValidationResult {
  const parsed = cleanedDataSchema.safeParse(records);
  if (parsed.success) {
    return { passed: true, errors: [] };
  }

  const errors = parsed.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  return { passed: false, errors };
}

function structuralValidatorNode(state: ADIGraphState): ADIStateUpdate {
  const result = runStructuralValidation(state.cleanedData);

  if (result.passed) {
    return {
      validationPassed: true,
      currentStep: "validate",
    };
  }

  const issue = `Structural validation failed: ${result.errors.join("; ")}`;
  const alreadyRecorded = state.anomalies.some(
    (anomaly) =>
      anomaly.row === 0 &&
      anomaly.field === "cleanedData" &&
      anomaly.issue === issue,
  );

  return {
    validationPassed: false,
    currentStep: "validate",
    ...(alreadyRecorded
      ? {}
      : {
          anomalies: [
            {
              row: 0,
              field: "cleanedData",
              issue,
              severity: "high" as const,
            },
          ],
        }),
  };
}

type PostValidationRoute = "cleaner" | "grader";

const routeAfterValidation = (state: ADIGraphState): PostValidationRoute => {
  if (state.validationPassed) {
    return "grader";
  }
  if (state.cleanAttempts >= MAX_CLEAN_ATTEMPTS) {
    return "grader";
  }
  return "cleaner";
};

export function buildADIGraph() {
  const workflow = new StateGraph(ADIStateAnnotation)
    .addNode("cleaner", cleanerNode)
    .addNode("structuralValidator", structuralValidatorNode)
    .addNode("grader", graderNode)
    .addEdge(START, "cleaner")
    .addEdge("cleaner", "structuralValidator")
    .addConditionalEdges("structuralValidator", routeAfterValidation, {
      cleaner: "cleaner",
      grader: "grader",
    })
    .addEdge("grader", END);

  return workflow.compile();
}

export const adiGraph = buildADIGraph();

export async function runADIWorkflow(
  rawData: ADIGraphState["rawData"],
): Promise<ADIGraphState> {
  return adiGraph.invoke({
    rawData,
    cleanedData: [],
    anomalies: [],
    repairs: [],
    currentStep: "ingest",
    cleanAttempts: 0,
  });
}
