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
    reducer: (_left, right) => right,
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
