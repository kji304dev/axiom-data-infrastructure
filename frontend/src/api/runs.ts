import { getApiBaseUrl } from "./config.js";
import type { GradeArtifact, RunsResponse } from "../types/runs.js";

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchRuns(): Promise<RunsResponse> {
  const response = await fetch(`${getApiBaseUrl()}/runs`);
  return readJsonResponse<RunsResponse>(response);
}

export async function fetchRunArtifact(runId: string): Promise<GradeArtifact> {
  const response = await fetch(
    `${getApiBaseUrl()}/runs/${encodeURIComponent(runId)}/artifact`,
  );
  return readJsonResponse<GradeArtifact>(response);
}
