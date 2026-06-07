export type RunInputType = "json" | "csv_upload";

export interface RunIndexEntry {
  run_id: string;
  created_at: string;
  input_type: RunInputType;
  record_count: number;
  artifact_uri: string;
  health_score: number;
  validation_passed: boolean;
  failed_record_count: number;
}

export interface RunsResponse {
  runs: RunIndexEntry[];
}

export type GradeArtifact = Record<string, unknown>;
