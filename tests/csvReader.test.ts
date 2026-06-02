import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readTicketCsv } from "../src/io/csvReader.js";
import { InputValidationError } from "../src/io/inputValidationError.js";
import {
  loadProfileConfig,
  mapHeadersToCanonical,
  normalizeHeader,
} from "../src/io/profileConfig.js";

describe("readTicketCsv input validation", () => {
  it("fails when the input file does not exist", () => {
    const missingPath = resolve("samples/does-not-exist.csv");

    expect(() => readTicketCsv(missingPath)).toThrow(InputValidationError);
    expect(() => readTicketCsv(missingPath)).toThrow(
      `Error: Input file not found: ${missingPath}`,
    );
  });

  it("fails when the CSV file is empty", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "adi-empty-csv-"));
    const csvPath = join(tempDir, "empty.csv");
    writeFileSync(csvPath, "\n", "utf-8");

    expect(() => readTicketCsv(csvPath)).toThrow(InputValidationError);
    expect(() => readTicketCsv(csvPath)).toThrow(
      `Error: Input CSV is empty: ${resolve(csvPath)}`,
    );

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("fails when required canonical fields cannot be mapped", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "adi-bad-headers-"));
    const csvPath = join(tempDir, "bad-headers.csv");
    writeFileSync(
      csvPath,
      "ticket_id,date,customer\n1001,2026-05-01,Acme\n",
      "utf-8",
    );

    expect(() => readTicketCsv(csvPath)).toThrow(InputValidationError);
    expect(() => readTicketCsv(csvPath)).toThrow(
      "Error: Input CSV is missing required mappable fields: material, quantity, unit, job_site",
    );

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads valid AEC ticket CSV files with canonical headers", () => {
    const rows = readTicketCsv("samples/dirty_aec_ticket.csv");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toEqual({
      ticket_id: "1001",
      date: "2026-05-01",
      customer: "Acme Builders",
      material: "Concrete",
      quantity: "12",
      unit: "yd3",
      job_site: "North Yard",
    });
  });

  it("maps alternate AEC headers to canonical fields", () => {
    const rows = readTicketCsv("samples/dirty_aec_ticket_alt_headers.csv");

    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      ticket_id: "1001",
      date: "2026-05-01",
      customer: "Acme Builders",
      material: "Concrete",
      quantity: "12",
      unit: "yd3",
      job_site: "North Yard",
    });
    expect(rows[1]).toEqual({
      ticket_id: "1002",
      date: "05/02/26",
      customer: "",
      material: "Gravel",
      quantity: "-4",
      unit: "tons",
      job_site: "",
    });
  });
});

describe("AEC profile header mapping", () => {
  const aecProfile = loadProfileConfig("aec");

  it("normalizes headers for alias lookup", () => {
    expect(normalizeHeader("Ticket No")).toBe("ticket no");
    expect(normalizeHeader("job_site")).toBe("job site");
    expect(normalizeHeader("  Material   Type ")).toBe("material type");
  });

  it("maps alternate header names to all canonical fields", () => {
    const headers = [
      "Ticket No",
      "Pour Date",
      "Client",
      "Material Type",
      "Qty",
      "UOM",
      "Site",
    ];

    const { columnIndexes, missingFields } = mapHeadersToCanonical(
      headers,
      aecProfile,
    );

    expect(missingFields).toEqual([]);
    expect(columnIndexes.get("ticket_id")).toBe(0);
    expect(columnIndexes.get("date")).toBe(1);
    expect(columnIndexes.get("customer")).toBe(2);
    expect(columnIndexes.get("material")).toBe(3);
    expect(columnIndexes.get("quantity")).toBe(4);
    expect(columnIndexes.get("unit")).toBe(5);
    expect(columnIndexes.get("job_site")).toBe(6);
  });
});
