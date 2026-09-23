import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRunArtifact, fetchRuns } from "../src/api/runs.js";
import { BackendRequestError } from "../src/api/errors.js";
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
    expect(screen.getByText(/CSV upload/)).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("fetches and displays artifact JSON after View Result", async () => {
    mockedFetchRuns.mockResolvedValue(sampleRuns);
    mockedFetchRunArtifact.mockResolvedValue({
      run_id: "abc123",
      validation_passed: false,
      health_score: 82,
      summary: {
        headline: "This file is mostly clean with minor issues.",
        data_grade: "B",
        health_score: 82,
        records_received: 100,
        records_clean: 82,
        records_flagged: 18,
        top_issues: [],
        recommended_next_steps: [
          "Review flagged records before importing into downstream systems.",
        ],
      },
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
    expect(screen.getByText("Saved artifact (raw JSON)")).toBeInTheDocument();
    expect(screen.getByTestId("summary-report")).toBeInTheDocument();
    expect(
      screen.getByText("This file is mostly clean with minor issues."),
    ).toBeInTheDocument();
  });

  it("shows an error when runs cannot be loaded", async () => {
    mockedFetchRuns.mockRejectedValue(
      new BackendRequestError(
        "Could not reach the ADI backend. Check the API base URL and backend deployment.",
        "network",
      ),
    );

    render(<RunHistory />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the ADI backend. Check the API base URL and backend deployment.",
    );
  });

  it("shows an error when artifact cannot be loaded", async () => {
    mockedFetchRuns.mockResolvedValue(sampleRuns);
    mockedFetchRunArtifact.mockRejectedValue(
      new BackendRequestError(
        "Backend request failed (HTTP 410). Confirm the deployed API is running and CORS is configured.",
        "http",
        410,
      ),
    );

    render(<RunHistory />);
    const user = userEvent.setup();

    await screen.findByTestId("run-row-abc123");
    await user.click(screen.getByRole("button", { name: "View Result" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend request failed (HTTP 410). Confirm the deployed API is running and CORS is configured.",
    );
  });
});
