/**
 * Resumen de liquidación: comprobantes aprobados por CxP vs anticipo.
 */
import type { ExpenseSettlement } from "@/utils/expenseSettlement";
import { formatMxn } from "@/utils/expenseSettlement";

export interface ExpenseSettlementSummaryProps {
  settlement: ExpenseSettlement;
  /** Vista en vivo mientras valida; resumen al cerrar el lote. */
  variant?: "preview" | "final";
}

const balanceTone: Record<
  ExpenseSettlement["balanceKind"],
  { border: string; bg: string; text: string }
> = {
  reembolso: {
    border: "border-[var(--color-warning-200,#E8D9A8)]",
    bg: "bg-[var(--color-warning-50,#FBF6E8)]",
    text: "text-[var(--color-warning-700,#7A5C10)]",
  },
  devolucion: {
    border: "border-[var(--color-primary-200,#C5D4B8)]",
    bg: "bg-[var(--color-primary-50,#EEF2E8)]",
    text: "text-[var(--color-primary-700,#2D3A22)]",
  },
  cuadrado: {
    border: "border-[var(--color-success-200,#B8D4C5)]",
    bg: "bg-[var(--color-success-50,#E8F5EE)]",
    text: "text-[var(--color-success-700,#1E5C3A)]",
  },
};

function balanceTitle(kind: ExpenseSettlement["balanceKind"]): string {
  if (kind === "reembolso") return "Reembolso al empleado";
  if (kind === "devolucion") return "Devolución a la empresa";
  return "Liquidación cuadrada";
}

export default function ExpenseSettlementSummary({
  settlement,
  variant = "preview",
}: ExpenseSettlementSummaryProps) {
  const tone = balanceTone[settlement.balanceKind];
  const isFinal = variant === "final";

  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] ${
        isFinal ? "p-0 border-0" : "p-4 sm:p-5 bg-[var(--color-surface-secondary)]"
      }`}
      role="region"
      aria-label={isFinal ? "Resumen final de liquidación" : "Vista previa de liquidación"}
    >
      {!isFinal && (
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Vista previa de liquidación
          </p>
          <p className="text-sm text-[var(--color-ink-secondary)] mt-1">
            Solo suma los comprobantes que ya aprobaste. Se actualiza al aprobar cada uno.
          </p>
        </header>
      )}

      {isFinal && (
        <p className="text-sm text-[var(--color-ink-secondary)] mb-4">
          Revisa el cálculo antes de marcar el lote como listo para pago.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-ink-muted)]">Anticipo solicitado</p>
          <p className="text-lg font-semibold tabular-nums text-[var(--color-ink)]">
            {formatMxn(settlement.requestedFee)}
          </p>
        </div>
        {settlement.imposedFee != null && settlement.imposedFee !== settlement.requestedFee && (
          <div className="space-y-1">
            <p className="text-xs text-[var(--color-ink-muted)]">Anticipo autorizado (CxP)</p>
            <p className="text-lg font-semibold tabular-nums text-[var(--color-ink)]">
              {formatMxn(settlement.imposedFee)}
            </p>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Informativo; el saldo se compara contra el anticipo solicitado.
            </p>
          </div>
        )}
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-ink-muted)]">
            Total comprobado (aprobado por ti)
          </p>
          <p className="text-lg font-semibold tabular-nums text-[var(--color-ink)]">
            {formatMxn(settlement.approvedTotal)}
          </p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {settlement.approvedCount === 0
              ? "Aún no has aprobado comprobantes en esta solicitud."
              : `${settlement.approvedCount} comprobante(s) aprobado(s)`}
          </p>
        </div>
      </div>

      {settlement.approvedLines.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--color-neutral-200)] rounded-md border border-[var(--color-neutral-200)] bg-white overflow-hidden">
          {settlement.approvedLines.map((line) => (
            <li
              key={line.receipt_id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="text-[var(--color-ink)] truncate">
                {line.receipt_type_name || "Comprobante"}{" "}
                <span className="text-[var(--color-ink-muted)]">#{line.receipt_id}</span>
              </span>
              <span className="tabular-nums font-medium shrink-0">
                {formatMxn(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div
        className={`mt-4 rounded-md border px-4 py-3 ${tone.border} ${tone.bg}`}
      >
        <p className={`text-xs font-semibold uppercase tracking-wide ${tone.text}`}>
          {balanceTitle(settlement.balanceKind)}
        </p>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${tone.text}`}>
          {formatMxn(Math.abs(settlement.balance))}
        </p>
        <p className="text-sm text-[var(--color-ink-secondary)] mt-2">
          {settlement.balanceDescription}
        </p>
        <p className="text-xs text-[var(--color-ink-muted)] mt-2 tabular-nums">
          {formatMxn(settlement.approvedTotal)} − {formatMxn(settlement.advanceAmount)} ={" "}
          {formatMxn(settlement.balance)}
        </p>
      </div>

      {!isFinal && settlement.pendingCount > 0 && (
        <p className="text-xs text-[var(--color-ink-muted)] mt-3">
          Quedan {settlement.pendingCount} comprobante(s) por revisar.
          {settlement.rejectedCount > 0 &&
            ` ${settlement.rejectedCount} rechazado(s) no entran en el total.`}
        </p>
      )}

      {isFinal && settlement.rejectedCount > 0 && (
        <p className="text-xs text-[var(--color-ink-muted)] mt-3">
          {settlement.rejectedCount} comprobante(s) rechazado(s) no se incluyen en el total
          aprobado.
        </p>
      )}
    </div>
  );
}
