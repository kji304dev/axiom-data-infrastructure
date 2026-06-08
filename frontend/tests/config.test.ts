import { describe, expect, it, vi } from "vitest";

import {
  buildApiUrl,
  getApiBaseUrl,
  normalizeApiBaseUrl,
} from "../src/api/config.js";

describe("api config", () => {
  it("normalizes trailing slashes from base URLs", () => {
    expect(normalizeApiBaseUrl("http://127.0.0.1:8000/")).toBe(
      "http://127.0.0.1:8000",
    );
    expect(normalizeApiBaseUrl("https://example.onrender.com///")).toBe(
      "https://example.onrender.com",
    );
  });

  it("builds endpoint URLs without duplicate slashes", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8000/");

    expect(buildApiUrl("/health")).toBe("http://127.0.0.1:8000/health");
    expect(buildApiUrl("grade/aec")).toBe("http://127.0.0.1:8000/grade/aec");
    expect(buildApiUrl("/runs/abc123/artifact")).toBe(
      "http://127.0.0.1:8000/runs/abc123/artifact",
    );

    vi.unstubAllEnvs();
  });

  it("falls back to localhost when VITE_API_BASE_URL is blank", () => {
    vi.stubEnv("VITE_API_BASE_URL", "   ");

    expect(getApiBaseUrl()).toBe("http://127.0.0.1:8000");

    vi.unstubAllEnvs();
  });
});
