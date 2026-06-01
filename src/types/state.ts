import { Annotation } from "@langchain/langgraph";

export type PipelineStep =
  | "ingest"
  | "clean"
  | "validate"
  | "grade"
  | "complete";

export type AnomalySeverity = "low" | "medium" | "high";

export interface Anomaly {
  row: number;
  field: string;
  issue: string;
  severity: AnomalySeverity;
}

export interface Repair {
  row: number;
  field: string;
  originalValue: string;
  cleanedValue: string;
  actionTaken: string;
  confidence: number;
  requiresReview: boolean;
}

export type RowStatusKind = "clean" | "repaired" | "needs_review" | "rejected";

export interface RowStatus {
  row: number;
  status: RowStatusKind;
  reason: string;
}

export type RecommendedDecision =
  | "approved"
  | "approved_with_changes"
  | "needs_customer_input"
  | "rejected";

export interface OperatorDecision {
  row: number;
  recommendedDecision: RecommendedDecision;
  reason: string;
}

export interface FinalOperatorDecision {
  row: number;
  recommendedDecision: RecommendedDecision;
  finalDecision: RecommendedDecision;
  operatorNote: string;
}

export interface RunMetadata {
  runId: string;
  inputFile: string;
  outputDirectory: string;
  generatedAt: string;
  engineVersion: string;
}

/** Single row from an industrial ticket CSV before cleaning. */
export type RawTicketRow = Record<string, string>;

/** Normalized AEC ticket record after structural cleaning. */
export interface AecTicketRecord {
  ticket_id: string;
  date: string;
  customer: string;
  material: string;
  quantity: number;
  unit: string;
  job_site: string;
}

export interface ADIState {
  rawData: RawTicketRow[];
  cleanedData: AecTicketRecord[];
  anomalies: Anomaly[];
  repairs: Repair[];
  rowStatuses: RowStatus[];
  operatorDecisions: OperatorDecision[];
  finalOperatorDecisions: FinalOperatorDecision[];
  runMetadata?: RunMetadata;
  currentStep: PipelineStep;
  healthScore?: number;
  validationPassed?: boolean;
  cleanAttempts: number;
}

export const REQUIRED_TICKET_FIELDS = [
  "ticket_id",
  "date",
  "customer",
  "material",
  "quantity",
  "unit",
  "job_site",
] as const;

export type RequiredTicketField = (typeof REQUIRED_TICKET_FIELDS)[number];

export const ADIStateAnnotation = Annotation.Root({
  rawData: Annotation<RawTicketRow[]>({
    reducer: (left, right) => (left.length === 0 ? right : left),
    default: () => [],
  }),
  cleanedData: Annotation<AecTicketRecord[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  anomalies: Annotation<Anomaly[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  repairs: Annotation<Repair[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  rowStatuses: Annotation<RowStatus[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  operatorDecisions: Annotation<OperatorDecision[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  finalOperatorDecisions: Annotation<FinalOperatorDecision[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  runMetadata: Annotation<RunMetadata | undefined>,
  currentStep: Annotation<PipelineStep>,
  healthScore: Annotation<number | undefined>,
  validationPassed: Annotation<boolean | undefined>,
  cleanAttempts: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
});

export type ADIGraphState = typeof ADIStateAnnotation.State;
export type ADIStateUpdate = typeof ADIStateAnnotation.Update;
