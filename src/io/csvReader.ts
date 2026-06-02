import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { InputValidationError } from "./inputValidationError.js";
import {
  loadProfileConfig,
  mapHeadersToCanonical,
  mapRowToCanonicalFields,
} from "./profileConfig.js";
import { DEFAULT_PROFILE, type DataProfile } from "./profiles.js";
import type { RawTicketRow } from "../types/state.js";

function parseCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

export function readTicketCsv(
  filePath: string,
  profile: DataProfile = DEFAULT_PROFILE,
): RawTicketRow[] {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    throw new InputValidationError(
      `Error: Input file not found: ${absolutePath}`,
    );
  }

  const profileConfig = loadProfileConfig(profile);
  const content = readFileSync(absolutePath, "utf-8");
  const trimmed = content.trim();

  if (!trimmed) {
    throw new InputValidationError(
      `Error: Input CSV is empty: ${absolutePath}`,
    );
  }

  const lines = trimmed.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  const { columnIndexes, missingFields } = mapHeadersToCanonical(
    headers,
    profileConfig,
  );

  if (missingFields.length > 0) {
    throw new InputValidationError(
      `Error: Input CSV is missing required mappable fields: ${missingFields.join(", ")}`,
    );
  }

  const rows: RawTicketRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    const values = parseCsvLine(line);
    rows.push(mapRowToCanonicalFields(values, columnIndexes));
  }

  if (rows.length === 0) {
    throw new InputValidationError(
      `Error: Input CSV is empty: ${absolutePath}`,
    );
  }

  return rows;
}
