import { apiFetch, readJsonResponse } from "./client.js";
import { toBackendRequestError } from "./errors.js";

export interface BackendHealth {
  status: string;
  service: string;
  version: string;
}

export type BackendConnectionStatus = "checking" | "connected" | "unreachable";

export async function fetchBackendHealth(): Promise<BackendHealth> {
  try {
    const response = await apiFetch("/health");
    return readJsonResponse<BackendHealth>(response);
  } catch (error) {
    throw toBackendRequestError(error);
  }
}
