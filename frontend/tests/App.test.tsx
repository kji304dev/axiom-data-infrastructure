import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { gradeAecCsvUpload } from "../src/api/grade.js";
import { BackendRequestError } from "../src/api/errors.js";
import { App } from "../src/App.js";

vi.mock("../src/api/health.js", () => ({
  fetchBackendHealth: vi.fn().mockResolvedValue({
    status: "ok",
    service: "adi-backend",
    version: "0.1.0",
  }),
}));

vi.mock("../src/api/runs.js", () => ({
  fetchRuns: vi.fn().mockResolvedValue({ runs: [] }),
  fetchRunArtifact: vi.fn(),
}));

vi.mock("../src/api/grade.js", () => ({
  gradeAecRecords: vi.fn(),
  gradeAecCsvUpload: vi.fn(),
}));

const mockedGradeAecCsvUpload = vi.mocked(gradeAecCsvUpload);

describe("App grading errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a user-friendly message when CSV upload cannot reach the backend", async () => {
    mockedGradeAecCsvUpload.mockRejectedValue(
      new BackendRequestError(
        "Could not reach the ADI backend. Check the API base URL and backend deployment.",
        "network",
      ),
    );

    render(<App />);
    const user = userEvent.setup();

    const fileInput = screen.getByLabelText(/Upload CSV or JSON/i);
    const csvFile = new File(["ticket_id,date\n1,01/01/26"], "demo.csv", {
      type: "text/csv",
    });
    await user.upload(fileInput, csvFile);
    await user.click(screen.getByRole("button", { name: "Upload & Analyze" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the ADI backend. Check the API base URL and backend deployment.",
    );
  });
});
