import type {
  ADIStateUpdate,
  ADIGraphState,
  Anomaly,
  Repair,
} from "../types/state.js";
import {
  REQUIRED_TICKET_FIELDS,
  type AecTicketRecord,
  type RawTicketRow,
  type RequiredTicketField,
} from "../types/state.js";

export type CleaningIssueKind = "timestamp" | "null_value" | "quantity";

export interface CleaningRoute {
  row: number;
  field: RequiredTicketField;
  kind: CleaningIssueKind;
}

interface CleaningResult {
  row: RawTicketRow;
  repair?: Repair;
  anomaly?: Anomaly;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLASH_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;

function stripCell(value: string | undefined): string {
  return (value ?? "").trim();
}

function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value);
}

function normalizeSlashDate(value: string): string | null {
  const match = SLASH_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);

  if (year < 100) {
    year = 2000 + year;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  const monthPadded = String(month).padStart(2, "0");
  const dayPadded = String(day).padStart(2, "0");
  return `${year}-${monthPadded}-${dayPadded}`;
}

function normalizeDateToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isIsoDate(trimmed)) {
    return trimmed;
  }

  const slashNormalized = normalizeSlashDate(trimmed);
  if (slashNormalized) {
    return slashNormalized;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function isSlashDateFormat(value: string): boolean {
  return SLASH_DATE_PATTERN.test(value.trim());
}

function isDuplicateAnomaly(anomalies: Anomaly[], candidate: Anomaly): boolean {
  return anomalies.some(
    (anomaly) =>
      anomaly.row === candidate.row &&
      anomaly.field === candidate.field &&
      anomaly.issue === candidate.issue,
  );
}

function isDuplicateRepair(repairs: Repair[], candidate: Repair): boolean {
  return repairs.some(
    (repair) =>
      repair.row === candidate.row &&
      repair.field === candidate.field &&
      repair.originalValue === candidate.originalValue &&
      repair.cleanedValue === candidate.cleanedValue,
  );
}

function appendUniqueAnomaly(
  existing: Anomaly[],
  pending: Anomaly[],
  candidate: Anomaly,
): void {
  if (
    !isDuplicateAnomaly(existing, candidate) &&
    !isDuplicateAnomaly(pending, candidate)
  ) {
    pending.push(candidate);
  }
}

function appendUniqueRepair(
  existing: Repair[],
  pending: Repair[],
  candidate: Repair,
): void {
  if (
    !isDuplicateRepair(existing, candidate) &&
    !isDuplicateRepair(pending, candidate)
  ) {
    pending.push(candidate);
  }
}

function routeRowIssues(
  row: RawTicketRow,
  rowNumber: number,
): CleaningRoute[] {
  const routes: CleaningRoute[] = [];

  for (const field of REQUIRED_TICKET_FIELDS) {
    const value = stripCell(row[field]);
    if (!value) {
      routes.push({ row: rowNumber, field, kind: "null_value" });
    }
  }

  const dateValue = stripCell(row.date);
  if (dateValue) {
    if (isSlashDateFormat(dateValue)) {
      routes.push({ row: rowNumber, field: "date", kind: "timestamp" });
    } else if (normalizeDateToIso(dateValue) === null) {
      routes.push({ row: rowNumber, field: "date", kind: "timestamp" });
    }
  }

  const quantityRaw = stripCell(row.quantity);
  if (quantityRaw) {
    const quantity = Number(quantityRaw);
    if (Number.isNaN(quantity) || quantity <= 0) {
      routes.push({ row: rowNumber, field: "quantity", kind: "quantity" });
    }
  } else if (!routes.some((route) => route.field === "quantity")) {
    routes.push({ row: rowNumber, field: "quantity", kind: "null_value" });
  }

  return routes;
}

function applyCleaningRoute(
  workingRow: RawTicketRow,
  route: CleaningRoute,
): CleaningResult {
  const nextRow = { ...workingRow };

  switch (route.kind) {
    case "timestamp": {
      const original = stripCell(nextRow.date);
      const normalized = normalizeDateToIso(original);
      if (normalized) {
        nextRow.date = normalized;
        if (original !== normalized) {
          return {
            row: nextRow,
            repair: {
              row: route.row,
              field: "date",
              originalValue: original,
              cleanedValue: normalized,
              actionTaken: "Normalized date from MM/DD/YY to ISO YYYY-MM-DD",
              confidence: 0.95,
              requiresReview: false,
            },
          };
        }
        return { row: nextRow };
      }
      return {
        row: nextRow,
        anomaly: {
          row: route.row,
          field: "date",
          issue: "Invalid date format",
          severity: "high",
        },
      };
    }
    case "null_value": {
      const original = stripCell(nextRow[route.field]);
      if (original) {
        return { row: nextRow };
      }
      if (route.field === "customer") {
        const cleanedValue = "UNKNOWN_CUSTOMER";
        nextRow.customer = cleanedValue;
        return {
          row: nextRow,
          repair: {
            row: route.row,
            field: "customer",
            originalValue: original,
            cleanedValue,
            actionTaken: "Filled missing customer with placeholder",
            confidence: 0.7,
            requiresReview: true,
          },
        };
      }
      if (route.field === "unit") {
        const cleanedValue = "ea";
        nextRow.unit = cleanedValue;
        return {
          row: nextRow,
          repair: {
            row: route.row,
            field: "unit",
            originalValue: original,
            cleanedValue,
            actionTaken: "Filled missing unit with default",
            confidence: 0.8,
            requiresReview: false,
          },
        };
      }
      if (route.field === "job_site") {
        const cleanedValue = "UNASSIGNED";
        nextRow.job_site = cleanedValue;
        return {
          row: nextRow,
          repair: {
            row: route.row,
            field: "job_site",
            originalValue: original,
            cleanedValue,
            actionTaken: "Filled missing job site with placeholder",
            confidence: 0.7,
            requiresReview: true,
          },
        };
      }
      return {
        row: nextRow,
        anomaly: {
          row: route.row,
          field: route.field,
          issue: "Missing required value",
          severity: "high",
        },
      };
    }
    case "quantity": {
      const original = stripCell(nextRow.quantity);
      const parsed = Number(original);
      if (!Number.isNaN(parsed) && parsed > 0) {
        nextRow.quantity = String(parsed);
        return { row: nextRow };
      }
      const cleanedValue = String(Math.abs(parsed) || 1);
      nextRow.quantity = cleanedValue;
      return {
        row: nextRow,
        repair: {
          row: route.row,
          field: "quantity",
          originalValue: original,
          cleanedValue,
          actionTaken: "Corrected invalid or negative quantity to absolute value",
          confidence: 0.75,
          requiresReview: true,
        },
      };
    }
    default: {
      const _exhaustive: never = route.kind;
      return _exhaustive;
    }
  }
}

function rowToRecord(row: RawTicketRow): AecTicketRecord | null {
  const ticket_id = stripCell(row.ticket_id);
  const date = stripCell(row.date);
  const customer = stripCell(row.customer);
  const material = stripCell(row.material);
  const unit = stripCell(row.unit);
  const job_site = stripCell(row.job_site);
  const quantity = Number(stripCell(row.quantity));

  if (
    !ticket_id ||
    !date ||
    !customer ||
    !material ||
    !unit ||
    !job_site ||
    Number.isNaN(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  return {
    ticket_id,
    date,
    customer,
    material,
    quantity,
    unit,
    job_site,
  };
}

function buildCleanedRecord(
  rawRow: RawTicketRow,
  cleanedRow: RawTicketRow,
): AecTicketRecord | null {
  const fromCleaned = rowToRecord(cleanedRow);
  if (fromCleaned) {
    return fromCleaned;
  }

  const ticket_id = stripCell(cleanedRow.ticket_id);
  const date = stripCell(cleanedRow.date);
  const customer = stripCell(cleanedRow.customer);
  const material = stripCell(cleanedRow.material);
  const unit = stripCell(cleanedRow.unit);
  const job_site = stripCell(cleanedRow.job_site);
  const quantityRaw = stripCell(cleanedRow.quantity);
  const quantity = Number(quantityRaw);

  if (!ticket_id && !stripCell(rawRow.ticket_id)) {
    return null;
  }

  return {
    ticket_id: ticket_id || stripCell(rawRow.ticket_id),
    date: date || stripCell(rawRow.date),
    customer: customer || stripCell(rawRow.customer),
    material: material || stripCell(rawRow.material),
    quantity: Number.isNaN(quantity) ? NaN : quantity,
    unit: unit || stripCell(rawRow.unit),
    job_site: job_site || stripCell(rawRow.job_site),
  };
}

/**
 * Cleaner node: applies repairs on copies of raw rows, preserves rawData,
 * and materializes cleanedData for downstream Zod validation.
 */
export function cleanerNode(state: ADIGraphState): ADIStateUpdate {
  const newAnomalies: Anomaly[] = [];
  const newRepairs: Repair[] = [];
  const cleanedData: AecTicketRecord[] = [];

  for (let index = 0; index < state.rawData.length; index += 1) {
    const rawRow = state.rawData[index];
    const rowNumber = index + 2;
    let workingRow = { ...rawRow };
    const routes = routeRowIssues(workingRow, rowNumber);

    for (const route of routes) {
      const result = applyCleaningRoute(workingRow, route);
      workingRow = result.row;
      if (result.repair) {
        appendUniqueRepair(state.repairs, newRepairs, result.repair);
      }
      if (result.anomaly) {
        appendUniqueAnomaly(state.anomalies, newAnomalies, result.anomaly);
      }
    }

    const record = buildCleanedRecord(rawRow, workingRow);
    if (record) {
      cleanedData.push(record);
    }
  }

  return {
    cleanedData,
    anomalies: newAnomalies,
    repairs: newRepairs,
    currentStep: "clean",
    cleanAttempts: state.cleanAttempts + 1,
    validationPassed: undefined,
  };
}
