import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryReport } from "../src/components/SummaryReport.js";

const sampleSummary = {
  headline: "This file needs cleanup before import.",
  data_grade: "C" as const,
  health_score: 72,
  records_received: 100,
  records_clean: 72,
  records_flagged: 28,
  top_issues: [
    {
      field: "date",
      issue: "Missing or invalid date",
      count: 11,
    },
  ],
  recommended_next_steps: [
    "Standardize ticket dates before import.",
    "Review flagged records before importing into downstream systems.",
  ],
};

describe("SummaryReport", () => {
  it("renders summary fields when summary is provided", () => {
    render(<SummaryReport summary={sampleSummary} />);

    expect(screen.getByTestId("summary-report")).toBeInTheDocument();
    expect(screen.getByText(sampleSummary.headline)).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("Records clean")).toBeInTheDocument();
    expect(screen.getByText(/Missing or invalid date/)).toBeInTheDocument();
    expect(
      screen.getByText("Standardize ticket dates before import."),
    ).toBeInTheDocument();
  });

  it("renders nothing when summary is missing", () => {
    const { container } = render(<SummaryReport summary={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
