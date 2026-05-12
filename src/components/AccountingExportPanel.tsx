/**
 * AccountingExportPanel — Exportación contable para ERP (M1-010).
 *
 * Allows "Cuentas por pagar" users to query accounting polizas by date range
 * and preview the structured JSON that the ERP would consume. Also supports
 * downloading the JSON payload as a file.
 *
 * Uses GET /api/export/contable?date_from=&date_to= which returns
 * { polizas: [...] } with the full SAP-compatible póliza structure.
 */

import { useCallback, useState } from "react";
import Button from "@components/Button";
import Toast from "@components/Toast";

interface Poliza {
  requestId?: number;
  docType?: string;
  polizaIndex?: number;
  detalles?: PolizaDetalle[];
  [key: string]: unknown;
}

interface PolizaDetalle {
  glAccount?: string;
  glAccountName?: string;
  indicatorDebitCredit?: string;
  amountDocCurrency?: number;
  currency?: string;
  taxCode?: string;
  costCenter?: string;
  assignment?: string;
  itemText?: string;
  [key: string]: unknown;
}

interface ExportResponse {
  polizas: Poliza[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function formatMxn(value: number | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });
}

export default function AccountingExportPanel() {
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgoISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [includeSynced, setIncludeSynced] = useState(false);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchPolizas = useCallback(async () => {
    if (!dateFrom) {
      setError("Fecha de inicio es requerida.");
      return;
    }
    setLoading(true);
    setError(null);
    setPolizas([]);
    setExpandedIdx(null);

    try {
      const base =
        (
          (import.meta as unknown as { env: Record<string, string> }).env
            ?.PUBLIC_API_BASE_URL ?? "https://localhost:3000/api"
        ).replace(/\/$/, "");

      const params = new URLSearchParams();
      params.set("date_from", dateFrom);
      params.set("date_to", dateTo || todayISO());
      if (includeSynced) params.set("status", "Sincronizado");

      const res = await fetch(`${base}/export/contable?${params}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const body = await res.text();
        let msg = `Error ${res.status}`;
        try {
          const j = JSON.parse(body);
          if (j.error) msg = j.error;
        } catch {
          /* not json */
        }
        throw new Error(msg);
      }

      const data: ExportResponse = await res.json();
      setPolizas(data.polizas ?? []);
      setFetched(true);

      if ((data.polizas ?? []).length === 0) {
        setToast({
          message: "No se encontraron pólizas en ese rango de fechas.",
          type: "info",
        });
      } else {
        setToast({
          message: `${data.polizas.length} póliza(s) obtenida(s).`,
          type: "success",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setToast({ message: `Error: ${msg}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, includeSynced]);

  const downloadJSON = useCallback(() => {
    if (polizas.length === 0) return;
    const blob = new Blob([JSON.stringify({ polizas }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `polizas_${dateFrom}_${dateTo || todayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToast({ message: "Archivo JSON descargado.", type: "success" });
  }, [polizas, dateFrom, dateTo]);

  const toggleExpand = (idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} key={toast.message + Date.now()} />}

      {/* Filters */}
      <section className="card-editorial p-4 sm:p-5" aria-label="Filtros de exportación">
        <p className="eyebrow mb-3">Rango de fechas</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label
              htmlFor="export-date-from"
              className="block text-xs text-[var(--color-ink-muted)] mb-1"
            >
              Desde
            </label>
            <input
              id="export-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          </div>

          <div>
            <label
              htmlFor="export-date-to"
              className="block text-xs text-[var(--color-ink-muted)] mb-1"
            >
              Hasta
            </label>
            <input
              id="export-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="export-include-synced"
              type="checkbox"
              checked={includeSynced}
              onChange={(e) => setIncludeSynced(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-primary-500 focus:ring-primary-200 cursor-pointer"
            />
            <label
              htmlFor="export-include-synced"
              className="text-sm text-[var(--color-ink-secondary)] cursor-pointer"
            >
              Incluir ya sincronizados
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="filled"
              color="primary"
              size="small"
              onClick={fetchPolizas}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Consultando…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="material-icons text-base">search</span>
                  Consultar
                </span>
              )}
            </Button>

            {polizas.length > 0 && (
              <Button
                type="button"
                variant="border"
                color="primary"
                size="small"
                onClick={downloadJSON}
              >
                <span className="flex items-center gap-2">
                  <span className="material-icons text-base">download</span>
                  Descargar JSON
                </span>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="card-editorial border-accent-400 bg-accent-50 p-3 text-sm text-accent-500">
          <span className="material-icons text-base mr-1 align-middle">error</span>
          {error}
        </div>
      )}

      {/* Empty state */}
      {fetched && polizas.length === 0 && !error && (
        <div className="card-editorial p-8 text-center">
          <span className="material-icons text-5xl text-[var(--color-neutral-300)] mb-3 block">
            inventory_2
          </span>
          <p className="text-sm text-[var(--color-ink-muted)]">
            No hay pólizas pendientes de exportar en este rango.
          </p>
          <p className="text-xs text-[var(--color-ink-muted)] mt-1">
            Activa "Incluir ya sincronizados" para ver lotes previamente exportados.
          </p>
        </div>
      )}

      {/* Results summary */}
      {polizas.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-0">
            <KpiCell
              label="Pólizas"
              value={String(polizas.length)}
              detail={`${dateFrom} → ${dateTo}`}
              position="first"
            />
            <KpiCell
              label="Solicitudes"
              value={String(new Set(polizas.map((p) => p.requestId)).size)}
              detail="Requests con póliza"
              position="middle"
            />
            <KpiCell
              label="Líneas totales"
              value={String(polizas.reduce((sum, p) => sum + (p.detalles?.length ?? 0), 0))}
              detail="Partidas contables"
              position="middle"
            />
            <KpiCell
              label="Estado"
              value="Listo"
              detail="Disponible para el ERP"
              variant="success"
              position="last"
            />
          </div>

          {/* Poliza list */}
          <section className="space-y-3">
            <p className="eyebrow">Vista previa de pólizas</p>
            {polizas.map((poliza, idx) => (
              <PolizaCard
                key={`${poliza.requestId}-${poliza.polizaIndex}-${idx}`}
                poliza={poliza}
                index={idx}
                isExpanded={expandedIdx === idx}
                onToggle={() => toggleExpand(idx)}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────── */

function KpiCell({
  label,
  value,
  detail,
  variant = "default",
  position,
}: {
  label: string;
  value: string;
  detail?: string;
  variant?: "default" | "success" | "warning";
  position: "first" | "middle" | "last";
}) {
  const valueColor =
    variant === "success"
      ? "text-success-500"
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
      <p className={`text-2xl font-light leading-tight ${valueColor}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{detail}</p>}
    </div>
  );
}

function PolizaCard({
  poliza,
  index,
  isExpanded,
  onToggle,
}: {
  poliza: Poliza;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const detalles = poliza.detalles ?? [];
  const totalDebe = detalles
    .filter((d) => d.indicatorDebitCredit === "S")
    .reduce((sum, d) => sum + (d.amountDocCurrency ?? 0), 0);
  const totalHaber = detalles
    .filter((d) => d.indicatorDebitCredit === "H")
    .reduce((sum, d) => sum + (d.amountDocCurrency ?? 0), 0);

  return (
    <div className="card-editorial overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-secondary)] transition-colors cursor-pointer text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 text-primary-500 text-xs font-medium shrink-0">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-ink)] truncate">
              Solicitud #{poliza.requestId} · Póliza {poliza.docType ?? "—"}{" "}
              <span className="text-[var(--color-ink-muted)] font-normal">
                (idx {poliza.polizaIndex ?? 0})
              </span>
            </p>
            <p className="text-xs text-[var(--color-ink-muted)]">
              {detalles.length} partida{detalles.length !== 1 ? "s" : ""} ·{" "}
              Debe {formatMxn(totalDebe)} · Haber {formatMxn(totalHaber)}
            </p>
          </div>
        </div>
        <span
          className={`material-icons text-[var(--color-ink-muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {/* Expandable detail */}
      {isExpanded && (
        <div className="border-t border-[var(--color-neutral-200)]">
          {/* Table of partidas */}
          {detalles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--color-surface-secondary)]">
                    <th className="text-left px-3 py-2 font-medium text-[var(--color-ink-secondary)]">
                      Cuenta
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--color-ink-secondary)]">
                      Nombre
                    </th>
                    <th className="text-center px-3 py-2 font-medium text-[var(--color-ink-secondary)]">
                      D/H
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--color-ink-secondary)]">
                      Monto
                    </th>
                    <th className="text-center px-3 py-2 font-medium text-[var(--color-ink-secondary)]">
                      Moneda
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--color-ink-secondary)]">
                      CC
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--color-ink-secondary)]">
                      Texto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d, i) => (
                    <tr
                      key={i}
                      className="border-t border-[var(--color-neutral-100)] hover:bg-[var(--color-surface-secondary)] transition-colors"
                    >
                      <td className="px-3 py-2 tabular-nums font-medium text-[var(--color-ink)]">
                        {d.glAccount ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-ink-secondary)] truncate max-w-[160px]">
                        {d.glAccountName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            d.indicatorDebitCredit === "S"
                              ? "bg-primary-50 text-primary-500"
                              : "bg-accent-50 text-accent-500"
                          }`}
                        >
                          {d.indicatorDebitCredit === "S" ? "Debe" : "Haber"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--color-ink)]">
                        {formatMxn(d.amountDocCurrency)}
                      </td>
                      <td className="px-3 py-2 text-center text-[var(--color-ink-muted)]">
                        {d.currency ?? "MXN"}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-ink-secondary)]">
                        {d.costCenter ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-ink-muted)] truncate max-w-[200px]">
                        {d.itemText ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--color-neutral-300)] bg-[var(--color-surface-secondary)]">
                    <td colSpan={2} className="px-3 py-2 font-medium text-[var(--color-ink)]">
                      Total
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-50 text-primary-500">
                        Debe
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-[var(--color-ink)]">
                      {formatMxn(totalDebe)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                  <tr className="bg-[var(--color-surface-secondary)]">
                    <td colSpan={2} className="px-3 py-2 font-medium text-[var(--color-ink)]" />
                    <td className="px-3 py-2 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-50 text-accent-500">
                        Haber
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-[var(--color-ink)]">
                      {formatMxn(totalHaber)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="p-4 text-sm text-[var(--color-ink-muted)]">
              Póliza sin partidas de detalle.
            </p>
          )}

          {/* Raw JSON preview */}
          <details className="border-t border-[var(--color-neutral-200)]">
            <summary className="px-4 py-2 text-xs text-[var(--color-ink-muted)] cursor-pointer hover:bg-[var(--color-surface-secondary)] transition-colors select-none">
              <span className="material-icons text-sm align-middle mr-1">data_object</span>
              Ver JSON crudo
            </summary>
            <pre className="px-4 py-3 text-[11px] leading-relaxed text-[var(--color-ink-secondary)] bg-[var(--color-surface-secondary)] overflow-x-auto max-h-[320px]">
              {JSON.stringify(poliza, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
