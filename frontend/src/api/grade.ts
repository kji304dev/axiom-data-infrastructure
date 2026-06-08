import { apiFetch, readJsonResponse } from "./client.js";
import type { GradeArtifact } from "../types/runs.js";

export async function gradeAecRecords(
  records: Record<string, unknown>[],
): Promise<GradeArtifact> {
  const response = await apiFetch("/grade/aec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records }),
  });
  return readJsonResponse<GradeArtifact>(response);
}

export async function gradeAecCsvUpload(file: File): Promise<GradeArtifact> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch("/grade/aec/upload", {
    method: "POST",
    body: formData,
  });
  return readJsonResponse<GradeArtifact>(response);
}
