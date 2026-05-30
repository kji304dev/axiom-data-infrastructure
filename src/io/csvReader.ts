import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RawTicketRow } from "../types/state.js";

function parseCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

export function readTicketCsv(filePath: string): RawTicketRow[] {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, "utf-8");
  const lines = content.trim().split(/\r?\n/);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const rows: RawTicketRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    const values = parseCsvLine(line);
    const row: RawTicketRow = {};

    for (let column = 0; column < headers.length; column += 1) {
      row[headers[column]] = values[column] ?? "";
    }

    rows.push(row);
  }

  return rows;
}
