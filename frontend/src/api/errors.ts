export type BackendRequestErrorKind = "network" | "http" | "unknown";

export class BackendRequestError extends Error {
  readonly kind: BackendRequestErrorKind;
  readonly status?: number;

  constructor(
    message: string,
    kind: BackendRequestErrorKind,
    status?: number,
  ) {
    super(message);
    this.name = "BackendRequestError";
    this.kind = kind;
    this.status = status;
  }
}

export function formatBackendReachabilityMessage(): string {
  return "Could not reach the ADI backend. Check the API base URL and backend deployment.";
}

export function formatBackendRequestFailureMessage(status?: number): string {
  if (status !== undefined) {
    return `Backend request failed (HTTP ${status}). Confirm the deployed API is running and CORS is configured.`;
  }
  return "Backend request failed. Confirm the deployed API is running and CORS is configured.";
}

export function toBackendRequestError(error: unknown): BackendRequestError {
  if (error instanceof BackendRequestError) {
    return error;
  }

  if (error instanceof TypeError) {
    return new BackendRequestError(
      formatBackendReachabilityMessage(),
      "network",
    );
  }

  if (error instanceof Error) {
    return new BackendRequestError(error.message, "unknown");
  }

  return new BackendRequestError(formatBackendReachabilityMessage(), "unknown");
}

export function getBackendErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof BackendRequestError) {
    return error.message;
  }
  return fallback;
}
