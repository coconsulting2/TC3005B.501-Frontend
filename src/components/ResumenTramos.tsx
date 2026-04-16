/**
 * ResumenTramos — Summary of expenses grouped by travel segment.
 *
 * Backend endpoint (feat/back/gasto-tramo):
 *   GET /api/viajes/:id/resumen-tramos
 *   Response: {
 *     viaje_id, total_general,
 *     tramos: [{
 *       tramo_id, router_index, origin_country, origin_city,
 *       destination_country, destination_city, beginning_date, ending_date,
 *       total_tramo,
 *       comprobantes: [{ gasto_tramo_id, receipt_id, receipt_type, amount, validation, submission_date }]
 *     }]
 *   }
 *
 * Expandable rows showing receipts per segment. Subtotals per segment
 * and consolidated total. Editorial table styling with 1px borders.
 */

import { useState, useEffect } from "react";

const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL;

/* ── Types matching real backend response ── */

interface Comprobante {
  gasto_tramo_id: number;
  receipt_id: number;
  receipt_type: string;
  amount: number;
  validation: string;       // "approved" | "pending" | "rejected"
  submission_date: string;
}

interface Tramo {
  tramo_id: number;
  router_index: number;
  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;
  beginning_date: string;
  ending_date: string;
  comprobantes: Comprobante[];
  total_tramo: number;
}

interface ResumenTramosResponse {
  viaje_id: number;
  tramos: Tramo[];
  total_general: number;
}

interface ResumenTramosProps {
  requestId: number;
  token: string;
}

/* ── Helpers ── */

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const validationLabels: Record<string, string> = {
  approved: "Aprobado",
  pending: "Pendiente",
  rejected: "Rechazado",
};

const validationPill: Record<string, string> = {
  approved: "bg-success-50 text-success-500",
  pending: "bg-warning-50 text-warning-500",
  rejected: "bg-accent-50 text-accent-400",
};

/* ── Component ── */

export default function ResumenTramos({ requestId, token }: ResumenTramosProps) {
  const [data, setData] = useState<ResumenTramosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedTramos, setExpandedTramos] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchResumen = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/viajes/${requestId}/resumen-tramos`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json: ResumenTramosResponse = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar resumen");
      } finally {
        setLoading(false);
      }
    };
    fetchResumen();
  }, [requestId, token]);

  const toggleTramo = (tramoId: number) => {
    setExpandedTramos((prev) => {
      const next = new Set(prev);
      next.has(tramoId) ? next.delete(tramoId) : next.add(tramoId);
      return next;
    });
  };

  /* ── Loading / Error / Empty ── */

  if (loading) {
    return (
      <div className="p-8 text-center text-[var(--color-ink-muted)]">
        Cargando resumen de tramos...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-start gap-3 p-4 border-l-4 rounded-[var(--radius-md)] bg-accent-50 border-accent-400 text-accent-500"
        role="alert"
      >
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.tramos.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--color-ink-muted)]">
        No hay tramos registrados para este viaje.
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="font-editorial text-xl font-medium text-[var(--color-ink)]">
          Resumen por tramos
        </h2>
        <span className="eyebrow">
          {data.tramos.length} tramo{data.tramos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tramos table */}
      <div className="card-editorial overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-[var(--color-neutral-200)]">
              <th className="eyebrow text-left px-4 py-3 w-8" aria-label="Expandir" />
              <th className="eyebrow text-left px-4 py-3">Tramo</th>
              <th className="eyebrow text-left px-4 py-3 hidden sm:table-cell">Fechas</th>
              <th className="eyebrow text-right px-4 py-3">Comprobantes</th>
              <th className="eyebrow text-right px-4 py-3">Subtotal</th>
            </tr>
          </thead>

          <tbody>
            {data.tramos.map((tramo) => {
              const isExpanded = expandedTramos.has(tramo.tramo_id);
              return (
                <TramoRow
                  key={tramo.tramo_id}
                  tramo={tramo}
                  isExpanded={isExpanded}
                  onToggle={() => toggleTramo(tramo.tramo_id)}
                />
              );
            })}
          </tbody>

          {/* Footer — total general */}
          <tfoot>
            <tr className="border-t-2 border-[var(--color-neutral-300)]">
              <td colSpan={4} className="px-4 py-3 text-right">
                <span className="text-sm font-medium text-[var(--color-ink-secondary)]">Total general</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="money-display text-base font-medium text-[var(--color-ink)]">
                  {formatMoney(data.total_general)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile total card */}
      <div className="sm:hidden card-editorial p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-ink-secondary)]">Total general</span>
        <span className="money-display text-lg font-medium text-[var(--color-ink)]">
          {formatMoney(data.total_general)}
        </span>
      </div>
    </div>
  );
}

/* ── Tramo Row (expandable) ── */

function TramoRow({
  tramo,
  isExpanded,
  onToggle,
}: {
  tramo: Tramo;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Summary row */}
      <tr
        className="border-b border-[var(--color-neutral-200)] hover:bg-[var(--color-surface-secondary)] transition-colors cursor-pointer"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <td className="px-4 py-3">
          <ChevronIcon expanded={isExpanded} />
        </td>
        <td className="px-4 py-3">
          <span className="text-sm font-medium text-[var(--color-ink)]">
            {tramo.origin_city} → {tramo.destination_city}
          </span>
          <span className="text-xs text-[var(--color-ink-muted)] block sm:hidden">
            {formatDate(tramo.beginning_date)} – {formatDate(tramo.ending_date)}
          </span>
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          <span className="text-sm text-[var(--color-ink-muted)]">
            {formatDate(tramo.beginning_date)} – {formatDate(tramo.ending_date)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-sm text-[var(--color-ink-secondary)] tabular-nums">
            {tramo.comprobantes.length}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="money-display text-sm text-[var(--color-ink)]">
            {formatMoney(tramo.total_tramo)}
          </span>
        </td>
      </tr>

      {/* Expanded detail rows */}
      {isExpanded && tramo.comprobantes.length > 0 && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-neutral-200)]">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="eyebrow text-left px-6 py-2 text-[0.625rem]">ID</th>
                    <th className="eyebrow text-left px-4 py-2 text-[0.625rem]">Rubro</th>
                    <th className="eyebrow text-left px-4 py-2 text-[0.625rem] hidden sm:table-cell">Fecha</th>
                    <th className="eyebrow text-center px-4 py-2 text-[0.625rem] hidden md:table-cell">Estado</th>
                    <th className="eyebrow text-right px-4 py-2 text-[0.625rem]">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {tramo.comprobantes.map((comp) => (
                    <tr key={comp.gasto_tramo_id} className="border-t border-[var(--color-neutral-200)]/50">
                      <td className="px-6 py-2 text-sm text-[var(--color-ink-muted)] tabular-nums">
                        #{comp.receipt_id}
                      </td>
                      <td className="px-4 py-2 text-sm text-[var(--color-ink-secondary)]">
                        {comp.receipt_type}
                      </td>
                      <td className="px-4 py-2 text-sm text-[var(--color-ink-muted)] hidden sm:table-cell">
                        {formatDate(comp.submission_date)}
                      </td>
                      <td className="px-4 py-2 text-center hidden md:table-cell">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide uppercase rounded-full ${
                            validationPill[comp.validation] ?? "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {validationLabels[comp.validation] ?? comp.validation}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="money-display text-sm text-[var(--color-ink-secondary)]">
                          {formatMoney(comp.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}

      {isExpanded && tramo.comprobantes.length === 0 && (
        <tr>
          <td
            colSpan={5}
            className="px-6 py-4 text-sm text-[var(--color-ink-muted)] bg-[var(--color-surface-secondary)] border-b border-[var(--color-neutral-200)]"
          >
            Sin comprobantes asociados a este tramo.
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Chevron Icon ── */

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-[var(--color-ink-muted)] transition-transform duration-200 ${
        expanded ? "rotate-90" : ""
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
