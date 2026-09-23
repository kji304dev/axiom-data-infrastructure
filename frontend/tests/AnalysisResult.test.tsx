import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisResult } from "../src/components/AnalysisResult.js";
import type { GradeArtifact } from "../src/types/artifact.js";

const messyFailedSummary = {
  headline: "This file is not ready for import.",
  data_grade: "F" as const,
  health_score: 0,
  records_received: 12,
  records_clean: 10,
  records_flagged: 2,
  top_issues: [],
  recommended_next_steps: ["Review flagged records before importing into downstream systems."],
};

const cleanPassedSummary = {
  headline: "This file is ready for import.",
  data_grade: "A" as const,
  health_score: 100,
  records_received: 1,
  records_clean: 1,
  records_flagged: 0,
  top_issues: [],
  recommended_next_steps: ["Review flagged records before importing into downstream systems."],
};

describe("AnalysisResult grade card readiness", () => {
  it("shows NOT READY FOR IMPORT with failure styling when validation_passed is false", () => {
    const artifact: GradeArtifact = {
      summary: messyFailedSummary,
      validation_passed: false,
      health_score: 0,
    };

    render(<AnalysisResult artifact={artifact} showRawJson={false} />);

    const gradeCard = document.querySelector(".grade-mark");
    expect(gradeCard).toHaveAttribute("data-ready", "false");
    expect(screen.getByText("Not ready for import")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
    expect(screen.getByText(messyFailedSummary.headline)).toBeInTheDocument();
  });

  it("shows READY FOR IMPORT with success styling when validation_passed is true", () => {
    const artifact: GradeArtifact = {
      summary: cleanPassedSummary,
      validation_passed: true,
      health_score: 100,
    };

    render(<AnalysisResult artifact={artifact} showRawJson={false} />);

    const gradeCard = document.querySelector(".grade-mark");
    expect(gradeCard).toHaveAttribute("data-ready", "true");
    expect(screen.getByText("Ready for import")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("does not treat a 'not ready for import' headline as ready", () => {
    const artifact: GradeArtifact = {
      summary: {
        ...messyFailedSummary,
        // Headline contains the substring "ready for import" but validation failed.
        headline: "This file is not ready for import.",
        data_grade: "F",
      },
      validation_passed: false,
    };

    render(<AnalysisResult artifact={artifact} showRawJson={false} />);

    expect(screen.getByText("Not ready for import")).toBeInTheDocument();
    expect(screen.queryByText("Ready for import")).not.toBeInTheDocument();
    expect(document.querySelector(".grade-mark")).toHaveAttribute(
      "data-ready",
      "false",
    );
  });
});
