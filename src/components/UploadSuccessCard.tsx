/**
 * UploadSuccessCard — Tarjeta estética post-registro de comprobante.
 *
 * Muestra los datos fiscales más relevantes del CFDI recién registrado
 * (emisor, receptor, montos, IVA, UUID, estado SAT) en un formato amigable
 * para el usuario final. El panel dev crudo (CfdiDevPreview) se muestra
 * colapsado al fondo solo en modo desarrollo.
 */
import type { ReceiptUploadResponse } from "@components/FileDropZone";
import CfdiDevPreview, { isDevTaxPreviewEnabled } from "@components/CfdiDevPreview";

/* ── Types ── */

interface CfdiRegistroResponse {
  uuid?: string;
  rfcEmisor?: string;
  nombreEmisor?: string;
  rfcReceptor?: string;
  nombreReceptor?: string;
  subtotal?: number;
  iva?: number;
  total?: number;
  fechaEmision?: string;
  moneda?: string;
  satEstado?: string;
  satCodigoEstatus?: string;
  satValidacionEfos?: string;
  metodoPago?: string;
  formaPago?: string;
  tipoComprobante?: string;
  version?: string;
  [key: string]: unknown;
}

interface Props {
  requestId: number;
  receiptId: number;
  concepto: string;
  apiBaseUrl: string;
  uploadResult: ReceiptUploadResponse | null;
  registroResponse: CfdiRegistroResponse | null;
  registroError: string | null;
  isInternational?: boolean;
}

/* ── Helpers ── */

function fmtMoney(value: number | undefined | null, currency = "MXN"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtDate(value: string | undefined | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function truncateUuid(uuid: string | undefined | null): string {
  if (!uuid) return "—";
  if (uuid.length <= 18) return uuid;
  return `${uuid.slice(0, 8)}…${uuid.slice(-4)}`;
}

function satBadge(estado: string | undefined | null) {
  if (!estado) return null;
  const lower = (estado ?? "").toLowerCase();
  if (lower === "vigente") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-600 bg-success-50 border border-success-200 px-2.5 py-1 rounded-full">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        Vigente
      </span>
    );
  }
  if (lower === "cancelado") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-600 bg-accent-50 border border-accent-200 px-2.5 py-1 rounded-full">
        ✕ Cancelado
      </span>
    );
  }
  if (lower === "internacional") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-200 px-2.5 py-1 rounded-full">
        🌎 Internacional
      </span>
    );
  }
  return (
    <span className="text-xs text-[var(--color-ink-muted)]">{estado}</span>
  );
}

/* ── Component ── */

export default function UploadSuccessCard({
  requestId,
  receiptId,
  concepto,
  apiBaseUrl,
  uploadResult,
  registroResponse,
  registroError,
  isInternational = false,
}: Props) {
  const reg = registroResponse as CfdiRegistroResponse | null;
  const cfdi = uploadResult?.cfdi;
  const showDevPanel = isDevTaxPreviewEnabled();

  // Prefer persisted registro data, fall back to upload cfdi summary
  const uuid = reg?.uuid ?? cfdi?.uuid;
  const rfcEmisor = reg?.rfcEmisor ?? cfdi?.rfcEmisor;
  const nombreEmisor = reg?.nombreEmisor;
  const rfcReceptor = reg?.rfcReceptor ?? cfdi?.rfcReceptor;
  const subtotal = reg?.subtotal;
  const iva = reg?.iva;
  const total = reg?.total ?? cfdi?.total;
  const fecha = reg?.fechaEmision ?? cfdi?.fecha;
  const moneda = reg?.moneda ?? "MXN";
  const satEstado = reg?.satEstado;
  const metodoPago = reg?.metodoPago;
  const formaPago = reg?.formaPago;

  return (
    <div className="space-y-6">
      {/* ── Success header ── */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-success-50 border-2 border-success-200 flex items-center justify-center">
          <svg className="w-6 h-6 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-[var(--color-ink)]">
            Comprobante registrado correctamente
          </h3>
          <p className="text-sm text-[var(--color-ink-muted)] mt-0.5">
            Tu comprobante de <strong className="text-[var(--color-ink-secondary)]">{concepto}</strong> fue validado con el SAT y guardado.
          </p>
        </div>
      </div>

      {/* ── Fiscal detail card ── */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] overflow-hidden">
        {/* Card header */}
        <div className="px-5 py-3 bg-[var(--color-surface-secondary)] border-b border-[var(--color-neutral-200)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-ink-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-[var(--color-ink-secondary)]">
              Detalle fiscal
            </span>
          </div>
          {satBadge(satEstado)}
        </div>

        {/* Card body — rows */}
        <div className="divide-y divide-[var(--color-neutral-100)]">
          {nombreEmisor && (
            <DetailRow label="Emisor" value={nombreEmisor} sublabel={rfcEmisor ?? undefined} />
          )}
          {!nombreEmisor && rfcEmisor && (
            <DetailRow label="RFC Emisor" value={rfcEmisor} />
          )}
          {rfcReceptor && (
            <DetailRow label="RFC Receptor" value={rfcReceptor} />
          )}
          <DetailRow label="Concepto" value={concepto} />
          <DetailRow label="Fecha de emisión" value={fmtDate(fecha)} />

          {/* Money section */}
          <div className="grid grid-cols-3 text-center divide-x divide-[var(--color-neutral-100)]">
            <div className="px-4 py-3">
              <p className="text-xs text-[var(--color-ink-muted)] mb-0.5">Subtotal</p>
              <p className="text-sm font-semibold text-[var(--color-ink)]">{fmtMoney(subtotal, moneda)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-[var(--color-ink-muted)] mb-0.5">IVA</p>
              <p className="text-sm font-semibold text-[var(--color-ink)]">{fmtMoney(iva, moneda)}</p>
            </div>
            <div className="px-4 py-3 bg-primary-50/30">
              <p className="text-xs text-primary-500 mb-0.5 font-medium">Total</p>
              <p className="text-base font-bold text-primary-600">{fmtMoney(total, moneda)}</p>
            </div>
          </div>

          {/* Metadata row */}
          <div className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--color-ink-muted)]">
            {uuid && (
              <span title={uuid}>
                <strong className="text-[var(--color-ink-secondary)]">UUID:</strong>{" "}
                <code className="bg-[var(--color-surface-secondary)] px-1.5 py-0.5 rounded text-[11px]">
                  {truncateUuid(uuid)}
                </code>
              </span>
            )}
            {moneda && (
              <span>
                <strong className="text-[var(--color-ink-secondary)]">Moneda:</strong> {moneda}
              </span>
            )}
            {metodoPago && (
              <span>
                <strong className="text-[var(--color-ink-secondary)]">Método:</strong> {metodoPago}
              </span>
            )}
            {formaPago && (
              <span>
                <strong className="text-[var(--color-ink-secondary)]">Forma:</strong> {formaPago}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Navigation buttons ── */}
      <div className="flex flex-wrap gap-3">
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-primary-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-600 transition-colors shadow-sm"
        >
          Ir al dashboard
        </a>
        <a
          href={`/comprobar-solicitud/${requestId}`}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-neutral-300)] bg-[var(--color-surface-white)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          Volver a comprobantes
        </a>
      </div>

      {/* ── Error badge (when CFDI registro failed but upload worked) ── */}
      {registroError && (
        <div className="rounded-[var(--radius-md)] border border-accent-200 bg-accent-50/40 px-4 py-3">
          <p className="text-sm text-accent-600">
            <strong>Nota:</strong> {registroError}
          </p>
        </div>
      )}

      {/* ── Dev panel (collapsed, only in dev mode) ── */}
      {showDevPanel && receiptId != null && uploadResult != null && (
        <details className="mt-2">
          <summary className="text-xs text-[var(--color-ink-muted)] cursor-pointer hover:text-[var(--color-ink-secondary)] transition-colors">
            🔧 Panel de desarrollo (JSON crudo)
          </summary>
          <div className="mt-2">
            <CfdiDevPreview
              requestId={requestId}
              receiptId={receiptId}
              apiBaseUrl={apiBaseUrl}
              upload={uploadResult}
              registroResponse={registroResponse}
              registroError={registroError}
            />
          </div>
        </details>
      )}
    </div>
  );
}

/* ── DetailRow sub-component ── */

function DetailRow({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between px-5 py-2.5 gap-4">
      <span className="text-xs font-medium text-[var(--color-ink-muted)] whitespace-nowrap">
        {label}
      </span>
      <div className="text-right min-w-0">
        <span className="text-sm text-[var(--color-ink)] break-all">{value}</span>
        {sublabel && (
          <span className="block text-xs text-[var(--color-ink-muted)]">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
