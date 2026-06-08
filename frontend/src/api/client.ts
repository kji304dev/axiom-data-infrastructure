import { buildApiUrl } from "./config.js";
import {
  BackendRequestError,
  formatBackendRequestFailureMessage,
  toBackendRequestError,
} from "./errors.js";

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(buildApiUrl(path), init);
  } catch (error) {
    throw toBackendRequestError(error);
  }
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new BackendRequestError(
      formatBackendRequestFailureMessage(response.status),
      "http",
      response.status,
    );
  }
  return (await response.json()) as T;
}
