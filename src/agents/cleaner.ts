import type { ADIStateUpdate, ADIGraphState, Anomaly } from "../types/state.js";
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
  } else if (!routes.some((r) => r.field === "quantity")) {
    routes.push({ row: rowNumber, field: "quantity", kind: "null_value" });
  }

  return routes;
}

function applyCleaningRoute(
  workingRow: RawTicketRow,
  route: CleaningRoute,
): { row: RawTicketRow; fixed: boolean; anomaly?: Anomaly } {
  const nextRow = { ...workingRow };

  switch (route.kind) {
    case "timestamp": {
      const original = stripCell(nextRow.date);
      const normalized = normalizeDateToIso(original);
      if (normalized) {
        nextRow.date = normalized;
        const wasNormalized = original !== normalized;
        return {
          row: nextRow,
          fixed: true,
          ...(wasNormalized
            ? {
                anomaly: {
                  row: route.row,
                  field: "date",
                  issue: `Date normalized from "${original}" to ISO ${normalized}`,
                  severity: "medium" as const,
                },
              }
            : {}),
        };
      }
      return {
        row: nextRow,
        fixed: false,
        anomaly: {
          row: route.row,
          field: "date",
          issue: "Invalid date format",
          severity: "high",
        },
      };
    }
    case "null_value": {
      const current = stripCell(nextRow[route.field]);
      if (current) {
        return { row: nextRow, fixed: true };
      }
      if (route.field === "customer") {
        nextRow.customer = "UNKNOWN_CUSTOMER";
        return { row: nextRow, fixed: true };
      }
      if (route.field === "unit") {
        nextRow.unit = "ea";
        return { row: nextRow, fixed: true };
      }
      if (route.field === "job_site") {
        nextRow.job_site = "UNASSIGNED";
        return { row: nextRow, fixed: true };
      }
      return {
        row: nextRow,
        fixed: false,
        anomaly: {
          row: route.row,
          field: route.field,
          issue: "Missing required value",
          severity: "high",
        },
      };
    }
    case "quantity": {
      const parsed = Number(stripCell(nextRow.quantity));
      if (!Number.isNaN(parsed) && parsed > 0) {
        nextRow.quantity = String(parsed);
        return { row: nextRow, fixed: true };
      }
      const fallback = Math.abs(parsed) || 1;
      if (fallback > 0) {
        nextRow.quantity = String(fallback);
        return {
          row: nextRow,
          fixed: true,
          anomaly: {
            row: route.row,
            field: "quantity",
            issue: "Quantity corrected from invalid or negative value",
            severity: "medium",
          },
        };
      }
      return {
        row: nextRow,
        fixed: false,
        anomaly: {
          row: route.row,
          field: "quantity",
          issue: "Invalid quantity",
          severity: "high",
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

/**
 * Cleaner node: routes each row through timestamp, null, and quantity fixers,
 * then materializes `cleanedData` for downstream Zod validation.
 */
export function cleanerNode(state: ADIGraphState): ADIStateUpdate {
  const workingRows = state.rawData.map((row) => ({ ...row }));
  const newAnomalies: Anomaly[] = [];

  for (let index = 0; index < workingRows.length; index += 1) {
    const rowNumber = index + 2;
    let row = workingRows[index];
    const routes = routeRowIssues(row, rowNumber);

    for (const route of routes) {
      const result = applyCleaningRoute(row, route);
      row = result.row;
      if (result.anomaly) {
        newAnomalies.push(result.anomaly);
      }
    }

    workingRows[index] = row;
  }

  const cleanedData = workingRows
    .map((row) => rowToRecord(row))
    .filter((record): record is AecTicketRecord => record !== null);

  return {
    rawData: workingRows,
    cleanedData,
    anomalies: newAnomalies,
    currentStep: "clean",
    cleanAttempts: state.cleanAttempts + 1,
    validationPassed: undefined,
  };
}
