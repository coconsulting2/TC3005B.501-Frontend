/**
 * ExchangeRateDisplay — Shows exchange rate info for international trips.
 *
 * Backend endpoint (feat/back/exchange-rate-integration):
 *   POST /api/exchange-rate/convert
 *   Body: { amount, source, target }
 *   Response: { success, data: { originalAmount, originalCurrency, convertedAmount,
 *     targetCurrency, exchangeRate, dataSource, rateDate, fromCache } }
 *
 * Displays: original amount, exchange rate, converted MXN amount, source (Wise/DOF), date.
 * All fields are readonly. Returns null when isInternational is false.
 */

import { useState, useEffect } from "react";

const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL;

/* ── Types matching real backend response ── */

interface ConvertResponse {
  success: boolean;
  data: {
    originalAmount: number;
    originalCurrency: string;
    convertedAmount: number;
    targetCurrency: string;
    exchangeRate: number;
    dataSource: string;   // "Wise" | "DOF"
    rateDate: string;     // "YYYY-MM-DD"
    fromCache: boolean;
  };
  message: string;
}

interface ExchangeRateDisplayProps {
  /** Whether the trip is international */
  isInternational: boolean;
  /** Original amount in foreign currency */
  montoOriginal: number;
  /** Foreign currency code (e.g. "USD", "EUR") — 3-letter ISO */
  moneda: string;
  /** Auth token */
  token: string;
  className?: string;
}

/* ── Helpers ── */

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
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/* ── Component ── */

export default function ExchangeRateDisplay({
  isInternational,
  montoOriginal,
  moneda,
  token,
  className = "",
}: ExchangeRateDisplayProps) {
  const [data, setData] = useState<ConvertResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isInternational || !moneda || montoOriginal <= 0) {
      setData(null);
      return;
    }

    const fetchConversion = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE_URL}/exchange-rate/convert`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            amount: montoOriginal,
            source: moneda,
            target: "MXN",
          }),
        });

        if (!res.ok) throw new Error(`Error ${res.status}`);

        const json: ConvertResponse = await res.json();
        if (!json.success) throw new Error(json.message || "Error en la conversión");

        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo obtener el tipo de cambio");
      } finally {
        setLoading(false);
      }
    };

    fetchConversion();
  }, [isInternational, montoOriginal, moneda, token]);

  // Not shown for national trips
  if (!isInternational) return null;

  if (loading) {
    return (
      <div className={`card-editorial p-4 ${className}`}>
        <div className="flex items-center gap-2 text-[var(--color-ink-muted)]">
          <SpinnerIcon className="w-4 h-4 animate-spin" />
          <span className="text-sm">Consultando tipo de cambio...</span>
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`card-editorial p-5 ${className}`}>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <ExchangeIcon className="w-4 h-4 text-[var(--color-ink-muted)]" />
        <span className="eyebrow">Tipo de cambio</span>
        {data.fromCache && (
          <span className="text-[0.625rem] text-[var(--color-ink-subtle)]">(en caché)</span>
        )}
      </div>

      {/* Rate info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReadonlyField
          label="Monto original"
          value={formatMoney(data.originalAmount, data.originalCurrency)}
        />

        <ReadonlyField
          label={`Tipo de cambio (${data.originalCurrency}/MXN)`}
          value={data.exchangeRate.toFixed(4)}
        />

        <ReadonlyField
          label="Monto en MXN"
          value={formatMoney(data.convertedAmount, "MXN")}
          highlight
        />

        <div>
          <ReadonlyField label="Fuente" value={data.dataSource} />
          <p className="text-xs text-[var(--color-ink-muted)] mt-1">
            Fecha: {formatDate(data.rateDate)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Readonly field ── */

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

/* ── SVG Icons ── */

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

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
