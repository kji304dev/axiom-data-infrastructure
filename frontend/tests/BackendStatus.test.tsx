import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchBackendHealth } from "../src/api/health.js";
import { BackendStatus } from "../src/components/BackendStatus.js";

vi.mock("../src/api/health.js", () => ({
  fetchBackendHealth: vi.fn(),
}));

const mockedFetchBackendHealth = vi.mocked(fetchBackendHealth);

describe("BackendStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a checking state initially", () => {
    mockedFetchBackendHealth.mockReturnValue(new Promise(() => undefined));

    render(<BackendStatus />);

    expect(screen.getByTestId("backend-status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking backend connection...",
    );
  });

  it("renders a connected state when health check succeeds", async () => {
    mockedFetchBackendHealth.mockResolvedValue({
      status: "ok",
      service: "adi-backend",
      version: "0.1.0",
    });

    render(<BackendStatus />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Backend connected (adi-backend v0.1.0).",
      );
    });
  });

  it("renders an unreachable state when health check fails", async () => {
    mockedFetchBackendHealth.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<BackendStatus />);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Backend unreachable. Check API base URL configuration.",
    );
  });
});
