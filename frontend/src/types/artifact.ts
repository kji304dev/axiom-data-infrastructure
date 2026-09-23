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
  original_value: string;
  cleaned_value: string;
  action_taken: string;
  requires_review: boolean;
  confidence: number;
}

export interface FailedRecord {
  row: number;
  reason: string;
  record: Record<string, unknown>;
}

export type ProcessingNode =
  | "analyzer"
  | "transformer"
  | "auditor"
  | "validator"
  | "complete";

export type ProcessingStatus = "start" | "success" | "retry" | "failed";

export interface ProcessingEvent {
  node: ProcessingNode;
  status: ProcessingStatus;
  message: string;
  retry_count: number;
  timestamp: string;
}

export interface HealthScoreExplanation {
  starting_score: number;
  high_severity_anomaly_count: number;
  medium_severity_anomaly_count: number;
  review_required_repair_count: number;
  confident_repair_count: number;
  failed_record_count: number;
  final_score: number;
}

export interface GradeArtifact {
  raw_records?: Record<string, unknown>[];
  cleaned_records?: Record<string, unknown>[];
  repairs?: Repair[];
  anomalies?: Anomaly[];
  failed_records?: FailedRecord[];
  processing_history?: ProcessingEvent[];
  retry_count?: number;
  correction_instruction?: string | null;
  health_score?: number;
  health_score_explanation?: HealthScoreExplanation;
  validation_passed?: boolean;
  run_id?: string | null;
  artifact_path?: string | null;
  artifact_uri?: string | null;
  summary?: unknown;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asRepairs(value: unknown): Repair[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Repair => {
    if (!isRecord(item)) {
      return false;
    }
    return (
      typeof item.row === "number" &&
      typeof item.field === "string" &&
      typeof item.original_value === "string" &&
      typeof item.cleaned_value === "string" &&
      typeof item.action_taken === "string" &&
      typeof item.requires_review === "boolean"
    );
  });
}

export function asAnomalies(value: unknown): Anomaly[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Anomaly => {
    if (!isRecord(item)) {
      return false;
    }
    return (
      typeof item.row === "number" &&
      typeof item.field === "string" &&
      typeof item.issue === "string" &&
      (item.severity === "low" ||
        item.severity === "medium" ||
        item.severity === "high")
    );
  });
}

export function asFailedRecords(value: unknown): FailedRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is FailedRecord => {
    if (!isRecord(item)) {
      return false;
    }
    return (
      typeof item.row === "number" &&
      typeof item.reason === "string" &&
      isRecord(item.record)
    );
  });
}

export function asProcessingHistory(value: unknown): ProcessingEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is ProcessingEvent => {
    if (!isRecord(item)) {
      return false;
    }
    return (
      typeof item.node === "string" &&
      typeof item.status === "string" &&
      typeof item.message === "string"
    );
  });
}

export function asHealthScoreExplanation(
  value: unknown,
): HealthScoreExplanation | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.starting_score !== "number" ||
    typeof value.high_severity_anomaly_count !== "number" ||
    typeof value.medium_severity_anomaly_count !== "number" ||
    typeof value.review_required_repair_count !== "number" ||
    typeof value.confident_repair_count !== "number" ||
    typeof value.failed_record_count !== "number" ||
    typeof value.final_score !== "number"
  ) {
    return null;
  }
  return value as unknown as HealthScoreExplanation;
}

export function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "(empty)";
  }
  return String(value);
}
