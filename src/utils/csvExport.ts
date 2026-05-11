/**
 * csvExport — small CSV helper used by the accounting admin pages.
 *
 * Tries first to download the CSV from the backend at
 * GET /accounting/export?format=csv&entity=<entity> (which uses
 * csv-stringify on the server). If the endpoint is not available yet,
 * falls back to a client-side generator that escapes RFC-4180 style.
 *
 * Browser-only — `triggerDownload` and the fallback use `window` and
 * `document`. Always invoked from React event handlers.
 */

export type CsvCell = string | number | boolean | null | undefined;

export interface CsvExportOptions {
  filename: string;
  columns: { key: string; header: string }[];
  rows: Record<string, CsvCell>[];
}

/**
 * Escapes a single cell according to RFC 4180: wrap in quotes when the
 * value contains a comma, newline or quote; double up internal quotes.
 */
export function escapeCsvCell(value: CsvCell): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv({ columns, rows }: Omit<CsvExportOptions, "filename">): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows
    .map((row) =>
      columns.map((col) => escapeCsvCell(row[col.key])).join(",")
    )
    .join("\r\n");
  return body ? `${header}\r\n${body}` : header;
}

export function triggerDownload(filename: string, content: string | Blob) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsvFromRows(opts: CsvExportOptions) {
  triggerDownload(opts.filename, buildCsv(opts));
}

/**
 * Best-effort CSV download. When `apiEndpoint` is set, tries to stream
 * the CSV from the backend; on failure (no network, 404, etc.) falls back
 * to building the CSV on the client from `fallbackRows`.
 */
export async function downloadCsvWithBackend(opts: {
  apiEndpoint?: string;
  entity?: string;
  token?: string;
  filename: string;
  columns: CsvExportOptions["columns"];
  fallbackRows: CsvExportOptions["rows"];
}): Promise<{ source: "backend" | "client" }> {
  const { apiEndpoint, entity, token, filename, columns, fallbackRows } = opts;

  if (apiEndpoint) {
    try {
      const url = new URL(
        apiEndpoint,
        typeof window !== "undefined" ? window.location.origin : "http://localhost"
      );
      url.searchParams.set("format", "csv");
      if (entity) url.searchParams.set("entity", entity);

      const res = await fetch(url.toString(), {
        method: "GET",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`CSV export failed: ${res.status}`);
      const blob = await res.blob();
      triggerDownload(filename, blob);
      return { source: "backend" };
    } catch (err) {
      console.warn(
        "[csvExport] backend export failed, falling back to client",
        err
      );
    }
  }

  downloadCsvFromRows({ filename, columns, rows: fallbackRows });
  return { source: "client" };
}
