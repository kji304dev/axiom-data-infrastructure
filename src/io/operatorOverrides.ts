import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type {
  FinalOperatorDecision,
  OperatorDecision,
} from "../types/state.js";

export const DEFAULT_OPERATOR_OVERRIDES_PATH = "operator/decisions.json";

const recommendedDecisionSchema = z.enum([
  "approved",
  "approved_with_changes",
  "needs_customer_input",
  "rejected",
]);

export const operatorOverrideSchema = z.object({
  row: z.number().int().positive(),
  finalDecision: recommendedDecisionSchema,
  operatorNote: z.string(),
});

export const operatorOverridesFileSchema = z.object({
  decisions: z.array(operatorOverrideSchema),
});

export type OperatorOverride = z.infer<typeof operatorOverrideSchema>;

export function readOperatorOverrides(
  filePath: string = DEFAULT_OPERATOR_OVERRIDES_PATH,
): OperatorOverride[] {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    return [];
  }

  const content = readFileSync(absolutePath, "utf-8");
  const parsed = operatorOverridesFileSchema.parse(JSON.parse(content));
  return parsed.decisions;
}

export function buildFinalOperatorDecisions(
  recommended: OperatorDecision[],
  overrides: OperatorOverride[],
): FinalOperatorDecision[] {
  const overrideByRow = new Map(
    overrides.map((override) => [override.row, override]),
  );

  return recommended.map((decision) => {
    const override = overrideByRow.get(decision.row);

    if (override) {
      return {
        row: decision.row,
        recommendedDecision: decision.recommendedDecision,
        finalDecision: override.finalDecision,
        operatorNote: override.operatorNote,
      };
    }

    return {
      row: decision.row,
      recommendedDecision: decision.recommendedDecision,
      finalDecision: decision.recommendedDecision,
      operatorNote: "",
    };
  });
}

export function applyFinalOperatorDecisions<
  T extends { operatorDecisions: OperatorDecision[] },
>(
  state: T,
  overrides: OperatorOverride[],
): T & { finalOperatorDecisions: FinalOperatorDecision[] } {
  return {
    ...state,
    finalOperatorDecisions: buildFinalOperatorDecisions(
      state.operatorDecisions,
      overrides,
    ),
  };
}

export function getFinalOperatorDecision(
  finalDecisions: FinalOperatorDecision[],
  csvRow: number,
): FinalOperatorDecision | undefined {
  return finalDecisions.find((decision) => decision.row === csvRow);
}
