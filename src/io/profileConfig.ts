import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REQUIRED_TICKET_FIELDS,
  type RawTicketRow,
  type RequiredTicketField,
} from "../types/state.js";
import type { DataProfile } from "./profiles.js";

export interface ProfileConfig {
  profile: string;
  canonicalFields: Record<RequiredTicketField, string[]>;
}

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveProfileConfigPath(profile: DataProfile): string {
  return resolve(`profiles/${profile}.default.json`);
}

export function loadProfileConfig(profile: DataProfile): ProfileConfig {
  const configPath = resolveProfileConfigPath(profile);
  const content = readFileSync(configPath, "utf-8");
  return JSON.parse(content) as ProfileConfig;
}

function buildAliasLookup(
  config: ProfileConfig,
): Map<string, RequiredTicketField> {
  const lookup = new Map<string, RequiredTicketField>();

  for (const field of REQUIRED_TICKET_FIELDS) {
    for (const alias of config.canonicalFields[field]) {
      lookup.set(normalizeHeader(alias), field);
    }
  }

  return lookup;
}

export function mapHeadersToCanonical(
  headers: string[],
  config: ProfileConfig,
): {
  columnIndexes: Map<RequiredTicketField, number>;
  missingFields: RequiredTicketField[];
} {
  const aliasLookup = buildAliasLookup(config);
  const columnIndexes = new Map<RequiredTicketField, number>();

  for (let index = 0; index < headers.length; index += 1) {
    const canonicalField = aliasLookup.get(normalizeHeader(headers[index]));
    if (canonicalField && !columnIndexes.has(canonicalField)) {
      columnIndexes.set(canonicalField, index);
    }
  }

  const missingFields = REQUIRED_TICKET_FIELDS.filter(
    (field) => !columnIndexes.has(field),
  );

  return { columnIndexes, missingFields };
}

export function mapRowToCanonicalFields(
  values: string[],
  columnIndexes: Map<RequiredTicketField, number>,
): RawTicketRow {
  const row: RawTicketRow = {};

  for (const field of REQUIRED_TICKET_FIELDS) {
    const columnIndex = columnIndexes.get(field);
    row[field] = columnIndex === undefined ? "" : (values[columnIndex] ?? "");
  }

  return row;
}
