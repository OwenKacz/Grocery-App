/**
 * CsvFlyerImportAdapter — imports prices from a CSV (a weekly flyer export, a
 * spreadsheet you maintain by hand, etc.). This is the easiest way to get real
 * data into the app without any API: edit a spreadsheet, save as CSV, import.
 *
 * ── config shape (stored on the `data_sources.config` jsonb column) ──────────
 *   {
 *     "filePath": "data/seed/sample-prices.csv"   // path relative to project root
 *     // — OR —
 *     "csv": "name,branch_id,regular_price\n..."   // the CSV content inline
 *   }
 * Provide exactly one of `filePath` or `csv`.
 *
 * ── expected CSV columns (header row required) ───────────────────────────────
 *   name,brand,category,package_size,barcode,branch_id,
 *   regular_price,sale_price,unit_price_value,unit_price_unit,in_stock
 *
 *   - Required per row: name, branch_id, regular_price.
 *   - branch_id is a `store_branches.id` (UUID) — that's how one CSV can carry
 *     prices for several branches.
 *   - Empty cells become "not provided".
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AdapterContext, DataSourceAdapter, NormalizedPrice } from "../types";

interface CsvConfig {
  filePath?: string;
  csv?: string;
}

export const csvFlyerImportAdapter: DataSourceAdapter = {
  type: "csv_flyer_import",
  description: "Imports prices from a CSV file or inline CSV text.",

  async fetchPrices(ctx: AdapterContext): Promise<NormalizedPrice[]> {
    const config = (ctx.source.config ?? {}) as CsvConfig;

    // 1) Get the raw CSV text, from inline config or a file on disk.
    let text: string;
    if (typeof config.csv === "string" && config.csv.trim().length > 0) {
      text = config.csv;
    } else if (config.filePath) {
      const absolute = path.resolve(process.cwd(), config.filePath);
      text = await readFile(absolute, "utf8");
    } else {
      throw new Error(
        'csv_flyer_import: config must include either "csv" or "filePath".',
      );
    }

    // 2) Parse it into rows of column->value.
    const rows = parseCsv(text);

    // 3) Map each row to a NormalizedPrice, skipping rows missing required cells.
    const prices: NormalizedPrice[] = [];
    for (const row of rows) {
      const name = row.name?.trim();
      const branchId = row.branch_id?.trim();
      const regularPrice = toNumber(row.regular_price);

      if (!name || !branchId || regularPrice === null) {
        // Not enough to be useful — skip rather than import junk.
        continue;
      }

      prices.push({
        name,
        brand: emptyToNull(row.brand),
        category: emptyToNull(row.category),
        packageSize: emptyToNull(row.package_size),
        barcode: emptyToNull(row.barcode),
        branchId,
        regularPrice,
        salePrice: toNumber(row.sale_price),
        unitPriceValue: toNumber(row.unit_price_value),
        unitPriceUnit: emptyToNull(row.unit_price_unit),
        inStock: row.in_stock ? toBoolean(row.in_stock) : true,
      });
    }

    return prices;
  },
};

// ── small helpers ────────────────────────────────────────────────────────────

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[$,]/g, "")); // tolerate "$3.99" / "1,000"
  return Number.isFinite(n) ? n : null;
}

function toBoolean(value: string): boolean {
  return /^(1|true|yes|y|in stock)$/i.test(value.trim());
}

/**
 * A small, dependency-free CSV parser. Handles quoted fields, escaped quotes
 * (""), commas inside quotes, and \n or \r\n line endings — enough for the
 * controlled spreadsheets this app imports. The first row is treated as headers.
 *
 * (If you later need to import messy third-party CSVs, swap this for a library
 * like papaparse — only this function changes.)
 */
function parseCsv(text: string): Array<Record<string, string>> {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // an escaped quote ("")
          i++;
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // End of line. Handle \r\n by skipping the paired \n.
      if (char === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      // Ignore blank lines.
      if (record.some((c) => c.trim() !== "")) records.push(record);
      record = [];
    } else {
      field += char;
    }
  }
  // Flush the final field/record if the file didn't end with a newline.
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    if (record.some((c) => c.trim() !== "")) records.push(record);
  }

  if (records.length === 0) return [];

  const headers = records[0].map((h) => h.trim());
  return records.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = cells[idx] ?? "";
    });
    return obj;
  });
}
