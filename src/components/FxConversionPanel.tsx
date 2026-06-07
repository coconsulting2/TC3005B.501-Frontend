/**
 * FxConversionPanel — Vista previa de tipo de cambio para gastos internacionales.
 * Usa GET /api/fx/convert (Frankfurter/ECB). El TC definitivo lo registra el backend al guardar.
 */

import { useFxConversion } from "@/hooks/useFxConversion";

export interface FxConversionPanelProps {
  /** Moneda extranjera (ISO 4217, ej. USD) */
  moneda: string;
  /** Monto en moneda extranjera */
  montoOriginal: number;
  /** Si false, no consulta ni renderiza */
  enabled?: boolean;
  className?: string;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ExchangeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      />
    </svg>
  );
}

function ReadonlyField({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-ink-muted)] mb-1 uppercase tracking-wide">
        {label}
      </label>
      <div
        className={`
          block w-full px-3 py-2.5 border rounded-[var(--radius-md)] text-sm
          bg-[var(--color-surface-secondary)] border-[var(--color-neutral-200)]
          cursor-default select-all
          ${highlight ? "money-display text-base font-medium text-[var(--color-ink)]" : "text-[var(--color-ink-secondary)]"}
        `}
        aria-readonly="true"
      >
        {value}
      </div>
    </div>
  );
}

export default function FxConversionPanel({
  moneda,
  montoOriginal,
  enabled = true,
  className = "",
}: FxConversionPanelProps) {
  const { data, loading, error } = useFxConversion({
    from: moneda,
    to: "MXN",
    amount: montoOriginal,
    enabled: enabled && montoOriginal > 0 && Boolean(moneda),
  });

  if (!enabled || montoOriginal <= 0 || !moneda) return null;

  if (loading) {
    return (
      <div className={`card-editorial p-4 ${className}`}>
        <div className="flex items-center gap-2 text-[var(--color-ink-muted)]">
          <SpinnerIcon className="w-4 h-4 animate-spin" />
          <span className="text-sm">Consultando tipo de cambio…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-start gap-3 p-4 border-l-4 rounded-[var(--radius-md)] bg-accent-50 border-accent-400 text-accent-500 ${className}`}
        role="alert"
      >
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <div>
          <p className="text-sm font-medium">No pudimos obtener el tipo de cambio</p>
          <p className="text-xs mt-0.5 opacity-90">
            Revisa tu conexión o intenta de nuevo. Al guardar, el sistema intentará registrar el tipo de cambio vigente.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`card-editorial p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <ExchangeIcon className="w-4 h-4 text-[var(--color-ink-muted)]" />
        <span className="eyebrow">Equivalente en pesos</span>
        {data.fromCache && (
          <span className="text-[0.625rem] text-[var(--color-ink-subtle)]">(en caché)</span>
        )}
      </div>
      <p className="text-xs text-[var(--color-ink-muted)] mb-4">
        Tipo de cambio referencial del día (ECB vía Frankfurter). Al guardar, el sistema registra el tipo de cambio vigente.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReadonlyField
          label="Monto original"
          value={formatMoney(data.amount, data.from)}
        />
        <ReadonlyField
          label={`Tipo de cambio (${data.from}/MXN)`}
          value={data.rate.toFixed(4)}
        />
        <ReadonlyField
          label="Monto en MXN"
          value={formatMoney(data.converted, "MXN")}
          highlight
        />
        <div>
          <ReadonlyField label="Fuente" value="ECB / Frankfurter" />
          <p className="text-xs text-[var(--color-ink-muted)] mt-1">
            Fecha: {formatDate(data.rateDate)}
          </p>
        </div>
      </div>
    </div>
  );
}
