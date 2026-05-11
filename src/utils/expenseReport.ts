/**
 * Helpers for the expenses-by-cost-center dashboard:
 *  - Period bucketing (YYYY-MM, YYYY-Qn)
 *  - Filtering report rows against the UI filter state
 *  - Building chart series (one bar per period; one stack segment per CC)
 *
 * The format chosen for period keys matches the contract documented in
 * `src/types/ExpenseReport.ts` and what the backend is expected to emit.
 */

import type {
  ExpenseReportFilters,
  ExpenseReportRow,
  ReportPeriod,
} from "@type/ExpenseReport";

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function formatPeriodKey(date: Date, period: ReportPeriod): string {
  const year = date.getFullYear();
  if (period === "monthly") {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

const MONTH_NAMES_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function formatPeriodLabel(key: string): string {
  if (/^\d{4}-Q[1-4]$/.test(key)) {
    return key.replace("Q", "T");
  }
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (match) {
    const year = match[1];
    const month = parseInt(match[2], 10) - 1;
    return `${MONTH_NAMES_ES[month] ?? ""} ${year.slice(2)}`;
  }
  return key;
}

/**
 * Returns the ordered list of period keys between `from` and `to`
 * inclusive (according to `period` granularity), so chart axes show
 * every bucket even when there are zero expenses.
 */
export function listPeriodKeys(
  from: string,
  to: string,
  period: ReportPeriod
): string[] {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return [];
  }
  let cursor =
    period === "monthly" ? startOfMonth(fromDate) : startOfQuarter(fromDate);
  const end =
    period === "monthly" ? startOfMonth(toDate) : startOfQuarter(toDate);
  const step = period === "monthly" ? 1 : 3;
  const keys: string[] = [];
  while (cursor.getTime() <= end.getTime()) {
    keys.push(formatPeriodKey(cursor, period));
    cursor = addMonths(cursor, step);
  }
  return keys;
}

export function filterRows(
  rows: ExpenseReportRow[],
  filters: ExpenseReportFilters
): ExpenseReportRow[] {
  const periodKeys = new Set(
    listPeriodKeys(filters.from, filters.to, filters.period)
  );
  const expenseTypes =
    filters.expenseTypes.length > 0 ? new Set(filters.expenseTypes) : null;
  const statuses =
    filters.statuses.length > 0 ? new Set(filters.statuses) : null;
  const costCenterIds =
    filters.costCenterIds.length > 0 ? new Set(filters.costCenterIds) : null;

  return rows.filter((row) => {
    if (!periodKeys.has(row.period)) return false;
    if (expenseTypes && !expenseTypes.has(row.expense_type)) return false;
    if (statuses && !statuses.has(row.status)) return false;
    if (costCenterIds && !costCenterIds.has(row.cost_center_id)) return false;
    return true;
  });
}

export interface ChartSeries {
  periodKeys: string[];
  costCenters: { id: number; code: string; name: string }[];
  /** Map of `periodKey -> { cc_id -> amount }`. */
  data: Record<string, Record<number, number>>;
  /** Stacked totals per period. */
  totals: Record<string, number>;
}

export function buildSeries(
  rows: ExpenseReportRow[],
  filters: ExpenseReportFilters
): ChartSeries {
  const periodKeys = listPeriodKeys(filters.from, filters.to, filters.period);
  const ccMap = new Map<
    number,
    { id: number; code: string; name: string }
  >();
  const data: Record<string, Record<number, number>> = {};
  const totals: Record<string, number> = {};

  periodKeys.forEach((k) => {
    data[k] = {};
    totals[k] = 0;
  });

  rows.forEach((row) => {
    if (!data[row.period]) return;
    ccMap.set(row.cost_center_id, {
      id: row.cost_center_id,
      code: row.cost_center_code,
      name: row.cost_center_name,
    });
    const bucket = data[row.period];
    bucket[row.cost_center_id] = (bucket[row.cost_center_id] ?? 0) + row.amount;
    totals[row.period] += row.amount;
  });

  const costCenters = Array.from(ccMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code, "es", { sensitivity: "base" })
  );

  return { periodKeys, costCenters, data, totals };
}

export function formatMxn(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMxnCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`;
  }
  return formatMxn(value);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function defaultFilters(period: ReportPeriod = "monthly"): ExpenseReportFilters {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1);
  return {
    period,
    from: toIsoDate(start),
    to: toIsoDate(today),
    expenseTypes: [],
    statuses: [],
    costCenterIds: [],
  };
}
