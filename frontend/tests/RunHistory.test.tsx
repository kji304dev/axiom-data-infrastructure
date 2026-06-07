import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRunArtifact, fetchRuns } from "../src/api/runs.js";
import { RunHistory } from "../src/components/RunHistory.js";

vi.mock("../src/api/runs.js", () => ({
  fetchRuns: vi.fn(),
  fetchRunArtifact: vi.fn(),
}));

const mockedFetchRuns = vi.mocked(fetchRuns);
const mockedFetchRunArtifact = vi.mocked(fetchRunArtifact);

const sampleRuns = {
  runs: [
    {
      run_id: "abc123",
      created_at: "2026-06-07T19:00:00Z",
      input_type: "csv_upload" as const,
      record_count: 100,
      artifact_uri: "local://runs/abc123/result.json",
      health_score: 82,
      validation_passed: false,
      failed_record_count: 18,
    },
  ],
};

describe("RunHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading state", () => {
    mockedFetchRuns.mockReturnValue(new Promise(() => undefined));

    render(<RunHistory />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading run history");
  });

  it("renders an empty state when there are no runs", async () => {
    mockedFetchRuns.mockResolvedValue({ runs: [] });

    render(<RunHistory />);

    expect(await screen.findByText(/No runs yet/)).toBeInTheDocument();
  });

  it("renders run rows when runs are returned", async () => {
    mockedFetchRuns.mockResolvedValue(sampleRuns);

    render(<RunHistory />);

    expect(await screen.findByTestId("run-row-abc123")).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
    expect(screen.getByText(/csv_upload/)).toBeInTheDocument();
    expect(screen.getByText(/failed records: 18/)).toBeInTheDocument();
  });

  it("fetches and displays artifact JSON after View Result", async () => {
    mockedFetchRuns.mockResolvedValue(sampleRuns);
    mockedFetchRunArtifact.mockResolvedValue({
      run_id: "abc123",
      validation_passed: false,
      health_score: 82,
    });

    render(<RunHistory />);
    const user = userEvent.setup();

    await screen.findByTestId("run-row-abc123");
    await user.click(screen.getByRole("button", { name: "View Result" }));

    await waitFor(() => {
      expect(mockedFetchRunArtifact).toHaveBeenCalledWith("abc123");
    });

    expect(await screen.findByTestId("artifact-preview")).toHaveTextContent(
      '"run_id": "abc123"',
    );
  });

  it("shows an error when runs cannot be loaded", async () => {
    mockedFetchRuns.mockRejectedValue(new Error("network error"));

    render(<RunHistory />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load run history.",
    );
  });

  it("shows an error when artifact cannot be loaded", async () => {
    mockedFetchRuns.mockResolvedValue(sampleRuns);
    mockedFetchRunArtifact.mockRejectedValue(new Error("missing artifact"));

    render(<RunHistory />);
    const user = userEvent.setup();

    await screen.findByTestId("run-row-abc123");
    await user.click(screen.getByRole("button", { name: "View Result" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load run artifact.",
    );
  });
});
