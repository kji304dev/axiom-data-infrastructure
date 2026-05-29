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

const TWO_DIGIT_YEAR_CUTOFF = 50;

function stripCell(value: string | undefined): string {
  return (value ?? "").trim();
}

function parseFlexibleDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) {
      year += year < TWO_DIGIT_YEAR_CUTOFF ? 2000 : 1900;
    }
    const iso = new Date(Date.UTC(year, month - 1, day));
    if (
      iso.getUTCFullYear() !== year ||
      iso.getUTCMonth() !== month - 1 ||
      iso.getUTCDate() !== day
    ) {
      return null;
    }
    return iso.toISOString().slice(0, 10);
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString().slice(0, 10);
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
  if (dateValue && parseFlexibleDate(dateValue) === null) {
    routes.push({ row: rowNumber, field: "date", kind: "timestamp" });
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
      const normalized = parseFlexibleDate(stripCell(nextRow.date));
      if (normalized) {
        nextRow.date = normalized;
        return { row: nextRow, fixed: true };
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
