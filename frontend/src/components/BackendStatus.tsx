import { useEffect, useState } from "react";

import { getApiBaseUrl } from "../api/config.js";
import {
  fetchBackendHealth,
  type BackendConnectionStatus,
} from "../api/health.js";

export function BackendStatus() {
  const [status, setStatus] = useState<BackendConnectionStatus>("checking");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function checkBackendConnection() {
      setStatus("checking");
      setDetail("Checking backend connection...");

      try {
        const health = await fetchBackendHealth();
        if (cancelled) {
          return;
        }
        setStatus("connected");
        setDetail(
          `Backend connected (${health.service} v${health.version}).`,
        );
      } catch {
        if (cancelled) {
          return;
        }
        setStatus("unreachable");
        setDetail(
          "Backend unreachable. Check API base URL configuration.",
        );
      }
    }

    void checkBackendConnection();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-labelledby="backend-status-heading"
      data-testid="backend-status"
    >
      <h2 id="backend-status-heading">Backend Status</h2>
      <p>
        API base URL: <code>{getApiBaseUrl()}</code>
      </p>
      {status === "checking" ? (
        <p role="status">{detail}</p>
      ) : status === "connected" ? (
        <p role="status">{detail}</p>
      ) : (
        <p role="alert">{detail}</p>
      )}
    </section>
  );
}
