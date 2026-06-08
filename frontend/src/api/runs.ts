import { apiFetch, readJsonResponse } from "./client.js";
import type { GradeArtifact, RunsResponse } from "../types/runs.js";

export async function fetchRuns(): Promise<RunsResponse> {
  const response = await apiFetch("/runs");
  return readJsonResponse<RunsResponse>(response);
}

export async function fetchRunArtifact(runId: string): Promise<GradeArtifact> {
  const response = await apiFetch(
    `/runs/${encodeURIComponent(runId)}/artifact`,
  );
  return readJsonResponse<GradeArtifact>(response);
}
