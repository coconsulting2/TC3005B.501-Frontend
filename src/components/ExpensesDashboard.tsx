/**
 * ExpensesDashboard — Stacked expenses-by-cost-center dashboard (M3-009).
 *
 * - Filters: period granularity (monthly/quarterly), date range,
 *   expense type, status, cost-center subset.
 * - Visuals: KPI cards, stacked SVG bar chart per period, list of
 *   budget alerts when a CC exceeds 80% of its assigned budget.
 * - Auto-refreshes every 60 seconds (configurable) so users don't have
 *   to reload the page. The poll pauses while the tab is hidden to
 *   keep the API quiet.
 *
 * Uses GET /api/reports/expenses-by-cc (`apiRequest` con base `/api`). Si la
 * petición falla, se mantienen datos de respaldo y un aviso no bloqueante.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@components/Button";
import {
  ALERT_THRESHOLD,
  REPORT_EXPENSE_TYPES,
  REPORT_EXPENSE_TYPE_LABEL,
  REPORT_STATUSES,
  REPORT_STATUS_LABEL,
  computeBudgetAlerts,
} from "@type/ExpenseReport";
import type {
  BudgetAlert,
  CostCenterBudget,
  ExpenseReportFilters,
  ExpenseReportResponse,
  ExpenseReportRow,
  ReportExpenseType,
  ReportPeriod,
  ReportStatus,
} from "@type/ExpenseReport";
import {
  buildSeries,
  defaultFilters,
  filterRows,
  formatMxn,
  formatMxnCompact,
  formatPeriodLabel,
} from "@utils/expenseReport";
import { apiRequest } from "@utils/apiClient";

interface ExpensesDashboardProps {
  apiEndpoint?: string;
  token?: string;
  /** Override polling interval, in milliseconds. */
  pollIntervalMs?: number;
}

const SERIES_COLORS = [
  "#3D4A2A",
  "#6B7D52",
  "#B8C09F",
  "#E07030",
  "#D97706",
  "#4A8C4A",
  "#7DBF7D",
  "#A8A7A2",
  "#4A4A48",
  "#0A0A0A",
];

const SEED_ROWS: ExpenseReportRow[] = (() => {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
  const ccs = [
    { id: 1, code: "CC-110", name: "Finanzas" },
    { id: 2, code: "CC-120", name: "Recursos Humanos" },
    { id: 3, code: "CC-210", name: "Logística" },
    { id: 4, code: "CC-310", name: "Comercial" },
  ];
  const types: ReportExpenseType[] = [
    "VIAJE_NACIONAL",
    "HOSPEDAJE",
    "TRANSPORTE",
    "ALIMENTOS",
  ];
  const statuses: ReportStatus[] = ["approved", "paid", "submitted"];
  const rows: ExpenseReportRow[] = [];
  months.forEach((month, mIdx) => {
    ccs.forEach((cc, ccIdx) => {
      types.forEach((type, tIdx) => {
        const status = statuses[(mIdx + ccIdx + tIdx) % statuses.length];
        const base = 15000 + ccIdx * 4500 + tIdx * 2200 + mIdx * 1800;
        const amount = Math.round(base * (0.85 + ((mIdx + tIdx) % 5) * 0.07));
        rows.push({
          cost_center_id: cc.id,
          cost_center_code: cc.code,
          cost_center_name: cc.name,
          period: month,
          amount,
          expense_type: type,
          status,
        });
      });
    });
  });
  return rows;
})();

const SEED_BUDGETS: CostCenterBudget[] = [
  {
    cost_center_id: 1,
    cost_center_code: "CC-110",
    cost_center_name: "Finanzas",
    budget: 320000,
    spent: 0,
  },
  {
    cost_center_id: 2,
    cost_center_code: "CC-120",
    cost_center_name: "Recursos Humanos",
    budget: 280000,
    spent: 0,
  },
  {
    cost_center_id: 3,
    cost_center_code: "CC-210",
    cost_center_name: "Logística",
    budget: 360000,
    spent: 0,
  },
  {
    cost_center_id: 4,
    cost_center_code: "CC-310",
    cost_center_name: "Comercial",
    budget: 420000,
    spent: 0,
  },
];

const SEED_RESPONSE: ExpenseReportResponse = {
  generated_at: new Date().toISOString(),
  rows: SEED_ROWS,
  budgets: SEED_BUDGETS,
};

const DEFAULT_POLL_MS = 60_000;

function buildQueryString(filters: ExpenseReportFilters): string {
  const params = new URLSearchParams();
  params.set("period", filters.period);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  filters.expenseTypes.forEach((t) => params.append("expenseType", t));
  filters.statuses.forEach((s) => params.append("status", s));
  filters.costCenterIds.forEach((id) =>
    params.append("costCenterId", String(id))
  );
  return params.toString();
}

function recomputeSpent(
  rows: ExpenseReportRow[],
  budgets: CostCenterBudget[]
): CostCenterBudget[] {
  const totals = new Map<number, number>();
  rows.forEach((row) => {
    totals.set(row.cost_center_id, (totals.get(row.cost_center_id) ?? 0) + row.amount);
  });
  return budgets.map((b) => ({
    ...b,
    spent: totals.get(b.cost_center_id) ?? 0,
  }));
}

export default function ExpensesDashboard({
  apiEndpoint = "/reports/expenses-by-cc",
  token,
  pollIntervalMs = DEFAULT_POLL_MS,
}: ExpensesDashboardProps) {
  const [filters, setFilters] = useState<ExpenseReportFilters>(() =>
    defaultFilters("monthly")
  );
  const [response, setResponse] = useState<ExpenseReportResponse>(SEED_RESPONSE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [usingSeed, setUsingSeed] = useState(true);

  const fetchReport = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const query = buildQueryString(filters);
      const url = query ? `${apiEndpoint}?${query}` : apiEndpoint;

      try {
        setLoading(true);
        const data = await apiRequest<ExpenseReportResponse>(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (signal?.aborted) return;
        if (data && Array.isArray(data.rows)) {
          setResponse(data);
          setUsingSeed(false);
          setError(null);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (signal?.aborted) return;
        console.warn("[ExpensesDashboard] fetch failed, using seed data", err);
        // Keep showing what we have; surface a banner only on the very
        // first failure so the user is not bombarded on every poll tick.
        setError((prev) =>
          prev ??
          "No se pudo conectar con el reporte en tiempo real. Mostrando datos de respaldo."
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [apiEndpoint, filters, token]
  );

  // Fetch on mount + when filters change.
  useEffect(() => {
    const controller = new AbortController();
    fetchReport(controller.signal);
    return () => controller.abort();
  }, [fetchReport]);

  // Polling — paused while the tab is hidden.
  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchReport();
    };
    timer = setInterval(tick, pollIntervalMs);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [fetchReport, pollIntervalMs]);

  const filteredRows = useMemo(
    () => filterRows(response.rows, filters),
    [response.rows, filters]
  );
  const series = useMemo(
    () => buildSeries(filteredRows, filters),
    [filteredRows, filters]
  );
  const liveBudgets = useMemo(
    () => recomputeSpent(filteredRows, response.budgets),
    [filteredRows, response.budgets]
  );
  const alerts = useMemo(() => computeBudgetAlerts(liveBudgets), [liveBudgets]);

  const grandTotal = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.amount, 0),
    [filteredRows]
  );
  const totalBudget = useMemo(
    () => liveBudgets.reduce((sum, b) => sum + b.budget, 0),
    [liveBudgets]
  );
  const utilization =
    totalBudget > 0 ? Math.round((grandTotal / totalBudget) * 100) : 0;

  const ccColor = useCallback(
    (ccId: number): string => {
      const idx = series.costCenters.findIndex((cc) => cc.id === ccId);
      return SERIES_COLORS[idx % SERIES_COLORS.length] ?? "#3D4A2A";
    },
    [series.costCenters]
  );

  const toggleInArray = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const resetFilters = () => setFilters(defaultFilters(filters.period));

  return (
    <div className="space-y-6">
      {/* Status row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
        <p className="text-[var(--color-ink-muted)]">
          {usingSeed ? "Datos de muestra" : "En vivo"} · Actualizado{" "}
          {lastUpdated.toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          {loading && (
            <span className="ml-2 text-primary-500">· Actualizando…</span>
          )}
        </p>
        <Button
          type="button"
          variant="border"
          color="primary"
          size="small"
          onClick={() => fetchReport()}
        >
          Refrescar ahora
        </Button>
      </div>

      {error && (
        <div className="card-editorial border-warning-400 bg-warning-50 p-3 text-sm text-warning-500">
          {error}
        </div>
      )}

      {/* Filters */}
      <section
        className="card-editorial p-4 sm:p-5"
        aria-label="Filtros del reporte"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="eyebrow mb-1.5">Granularidad</p>
            <div
              className="inline-flex border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] overflow-hidden text-sm"
              role="tablist"
              aria-label="Granularidad del periodo"
            >
              {(["monthly", "quarterly"] as ReportPeriod[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={filters.period === p}
                  onClick={() =>
                    setFilters((f) => ({ ...f, period: p }))
                  }
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    filters.period === p
                      ? "bg-primary-500 text-white"
                      : "bg-[var(--color-surface-white)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-secondary)]"
                  }`}
                >
                  {p === "monthly" ? "Mensual" : "Trimestral"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow mb-1.5">Desde</p>
            <input
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((f) => ({ ...f, from: e.target.value }))
              }
              className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          </div>

          <div>
            <p className="eyebrow mb-1.5">Hasta</p>
            <input
              type="date"
              value={filters.to}
              onChange={(e) =>
                setFilters((f) => ({ ...f, to: e.target.value }))
              }
              className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="border"
              color="primary"
              size="small"
              onClick={resetFilters}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <fieldset>
            <legend className="eyebrow mb-1.5">Tipo de gasto</legend>
            <div className="flex flex-wrap gap-2">
              {REPORT_EXPENSE_TYPES.map((t) => {
                const checked = filters.expenseTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        expenseTypes: toggleInArray(f.expenseTypes, t),
                      }))
                    }
                    aria-pressed={checked}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors cursor-pointer ${
                      checked
                        ? "bg-primary-500 border-primary-500 text-white"
                        : "bg-[var(--color-surface-white)] border-[var(--color-neutral-300)] text-[var(--color-ink-secondary)] hover:border-primary-400"
                    }`}
                  >
                    {REPORT_EXPENSE_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="eyebrow mb-1.5">Estatus</legend>
            <div className="flex flex-wrap gap-2">
              {REPORT_STATUSES.map((s) => {
                const checked = filters.statuses.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        statuses: toggleInArray(f.statuses, s),
                      }))
                    }
                    aria-pressed={checked}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors cursor-pointer ${
                      checked
                        ? "bg-primary-500 border-primary-500 text-white"
                        : "bg-[var(--color-surface-white)] border-[var(--color-neutral-300)] text-[var(--color-ink-secondary)] hover:border-primary-400"
                    }`}
                  >
                    {REPORT_STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </section>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0">
        <KpiCell
          label="Gasto acumulado"
          value={formatMxn(grandTotal)}
          detail={`${filteredRows.length} comprobantes`}
          position="first"
          isMoney
        />
        <KpiCell
          label="Presupuesto total"
          value={formatMxn(totalBudget)}
          detail={`${liveBudgets.length} CCs activos`}
          position="middle"
          isMoney
        />
        <KpiCell
          label="Utilización"
          value={`${utilization}%`}
          detail={
            utilization >= 80
              ? "Por encima del umbral"
              : "Dentro de presupuesto"
          }
          variant={utilization >= 100 ? "negative" : utilization >= 80 ? "warning" : "default"}
          position="middle"
        />
        <KpiCell
          label="Alertas activas"
          value={String(alerts.length)}
          detail={
            alerts.length
              ? `${alerts.filter((a) => a.level === "critical").length} sobre presupuesto`
              : "Todos los CCs por debajo del 80%"
          }
          variant={alerts.length ? "negative" : "default"}
          position="last"
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="card-editorial p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow text-accent-400">
              Centros de costos sobre el {Math.round(ALERT_THRESHOLD * 100)}%
              del presupuesto
            </p>
            <p className="text-xs text-[var(--color-ink-muted)]">
              {alerts.length}{" "}
              {alerts.length === 1 ? "CC en alerta" : "CCs en alerta"}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {alerts.map((alert) => (
              <AlertCard key={alert.cost_center_id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {/* Chart */}
      <section className="card-editorial p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow">Gasto por centro de costos</p>
            <p className="text-sm text-[var(--color-ink-muted)]">
              {filters.period === "monthly" ? "Mensual" : "Trimestral"} · stacked
              por CC
            </p>
          </div>
        </div>
        <StackedBarChart series={series} colorFor={ccColor} />
        <ChartLegend series={series} colorFor={ccColor} />
      </section>
    </div>
  );
}

function KpiCell({
  label,
  value,
  detail,
  variant = "default",
  isMoney = false,
  position,
}: {
  label: string;
  value: string;
  detail?: string;
  variant?: "default" | "negative" | "warning";
  isMoney?: boolean;
  position: "first" | "middle" | "last";
}) {
  const valueColor =
    variant === "negative"
      ? "text-accent-400"
      : variant === "warning"
        ? "text-warning-500"
        : "text-[var(--color-ink)]";
  const borderRadius =
    position === "first"
      ? "rounded-l-[var(--radius-lg)] rounded-r-none border-r-0"
      : position === "middle"
        ? "rounded-none border-r-0"
        : "rounded-r-[var(--radius-lg)] rounded-l-none";
  return (
    <div
      className={`bg-[var(--color-surface-white)] border border-[var(--color-neutral-200)] px-5 py-4 ${borderRadius}`}
    >
      <p className="eyebrow mb-1">{label}</p>
      <p
        className={`text-2xl font-light leading-tight ${valueColor} ${
          isMoney ? "money-display" : ""
        }`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{detail}</p>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: BudgetAlert }) {
  const pct = Math.round(alert.utilization * 100);
  const isCritical = alert.level === "critical";
  return (
    <div
      className={`card-editorial p-3 border-l-4 ${
        isCritical ? "border-accent-400" : "border-warning-400"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--color-ink)] truncate">
          {alert.cost_center_code} · {alert.cost_center_name}
        </p>
        <span
          className={`status-pill ${
            isCritical
              ? "bg-accent-50 text-accent-400"
              : "bg-warning-50 text-warning-500"
          }`}
        >
          {pct}%
        </span>
      </div>
      <p className="text-xs text-[var(--color-ink-muted)] mt-1 tabular-nums">
        {formatMxn(alert.spent)} de {formatMxn(alert.budget)}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden">
        <div
          className={isCritical ? "h-full bg-accent-400" : "h-full bg-warning-400"}
          style={{ width: `${Math.min(pct, 100)}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function ChartLegend({
  series,
  colorFor,
}: {
  series: ReturnType<typeof buildSeries>;
  colorFor: (ccId: number) => string;
}) {
  if (series.costCenters.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
      {series.costCenters.map((cc) => (
        <span
          key={cc.id}
          className="inline-flex items-center gap-2 text-xs text-[var(--color-ink-secondary)]"
        >
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: colorFor(cc.id) }}
            aria-hidden="true"
          />
          {cc.code} · {cc.name}
        </span>
      ))}
    </div>
  );
}

function StackedBarChart({
  series,
  colorFor,
}: {
  series: ReturnType<typeof buildSeries>;
  colorFor: (ccId: number) => string;
}) {
  const width = 720;
  const height = 280;
  const padding = { top: 16, right: 16, bottom: 40, left: 56 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const periodKeys = series.periodKeys;
  const maxTotal = periodKeys.reduce(
    (max, k) => Math.max(max, series.totals[k] ?? 0),
    0
  );

  if (periodKeys.length === 0 || maxTotal === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[var(--color-ink-muted)] border border-dashed border-[var(--color-neutral-200)] rounded-[var(--radius-md)]"
        style={{ height: 200 }}
      >
        No hay gastos para el rango seleccionado.
      </div>
    );
  }

  const yMax = niceCeil(maxTotal);
  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) =>
    Math.round((yMax * i) / ticks)
  );
  const yScale = (value: number) =>
    padding.top + innerHeight - (value / yMax) * innerHeight;

  const bandWidth = innerWidth / periodKeys.length;
  const barWidth = Math.min(48, Math.max(16, bandWidth * 0.7));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Gráfica de gasto acumulado por centro de costos"
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid */}
        {tickValues.map((tv) => {
          const y = yScale(tv);
          return (
            <g key={tv}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--color-neutral-200)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--color-ink-muted)"
              >
                {formatMxnCompact(tv)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {periodKeys.map((key, idx) => {
          const bandCenter = padding.left + bandWidth * (idx + 0.5);
          const x = bandCenter - barWidth / 2;
          let cumulative = 0;
          const segments = series.costCenters
            .map((cc) => {
              const value = series.data[key]?.[cc.id] ?? 0;
              if (value === 0) return null;
              const yStart = yScale(cumulative + value);
              const yEnd = yScale(cumulative);
              cumulative += value;
              return { cc, value, yStart, yEnd };
            })
            .filter((s): s is NonNullable<typeof s> => s !== null);

          return (
            <g key={key}>
              {segments.map((seg) => (
                <rect
                  key={seg.cc.id}
                  x={x}
                  y={seg.yStart}
                  width={barWidth}
                  height={Math.max(seg.yEnd - seg.yStart, 0)}
                  fill={colorFor(seg.cc.id)}
                  opacity={0.92}
                >
                  <title>
                    {seg.cc.code} · {seg.cc.name} — {formatMxn(seg.value)}
                  </title>
                </rect>
              ))}
              <text
                x={bandCenter}
                y={padding.top + innerHeight + 16}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-ink-secondary)"
              >
                {formatPeriodLabel(key)}
              </text>
              {series.totals[key] > 0 && (
                <text
                  x={bandCenter}
                  y={Math.max(yScale(series.totals[key]) - 6, padding.top + 10)}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-ink-muted)"
                >
                  {formatMxnCompact(series.totals[key])}
                </text>
              )}
            </g>
          );
        })}

        {/* X axis */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + innerHeight}
          y2={padding.top + innerHeight}
          stroke="var(--color-neutral-300)"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const normalized = value / base;
  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}
