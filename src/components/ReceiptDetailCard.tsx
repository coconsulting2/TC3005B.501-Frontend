/**
 * ReceiptDetailCard — Tarjeta reutilizable para mostrar un comprobante
 * con detalle fiscal expandible y preview de documentos.
 *
 * Usada en:
 *  - comprobar-solicitud/[id] (Solicitante: solo lectura)
 *  - comprobar-gastos/[id] (CxP: lectura + acciones)
 */

/* ── Types ── */

export interface ReceiptCfdi {
  nombreEmisor: string;
  rfcEmisor: string;
  fechaEmision: string;
  subtotal: number;
  iva: number;
  total: number;
  moneda: string;
  uuid: string;
  satEstado: string;
  tipoComprobante: string;
}

export interface ReceiptFile {
  fileId: string;
  fileName: string;
}

export interface ReceiptDetailProps {
  index: number;
  receiptId: number;
  receiptTypeName: string;
  amount: number;
  validation: string;
  cfdi: ReceiptCfdi | null;
  /** Files metadata — pass from /files/receipt-files/:id */
  pdf?: ReceiptFile | null;
  xml?: ReceiptFile | null;
  /** Image for international receipts */
  receiptImage?: ReceiptFile | null;
  apiBaseUrl: string;
  /** Whether this is the last item (no bottom border) */
  isLast?: boolean;
  /** Extra actions slot (JSX children — e.g. approve/reject buttons) */
  children?: React.ReactNode;
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

const validationStyles: Record<string, string> = {
  Aprobado: "bg-success-50 text-success-600 border-success-200",
  Rechazado: "bg-accent-50 text-accent-600 border-accent-200",
  Pendiente: "bg-amber-50 text-amber-600 border-amber-200",
};

function SatBadge({ estado }: { estado: string | null | undefined }) {
  if (!estado) return null;
  const lower = estado.toLowerCase();
  if (lower === "vigente") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-600 bg-success-50 border border-success-200 px-2 py-0.5 rounded-full">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        Vigente
      </span>
    );
  }
  if (lower === "cancelado") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-600 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded-full">
        ✕ Cancelado
      </span>
    );
  }
  if (lower === "internacional") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-full">
        🌎 Internacional
      </span>
    );
  }
  return <span className="text-[11px] text-[var(--color-ink-muted)]">{estado}</span>;
}

/* ── Component ── */

export default function ReceiptDetailCard({
  index,
  receiptId,
  receiptTypeName,
  amount,
  validation,
  cfdi,
  pdf,
  xml,
  receiptImage,
  apiBaseUrl,
  isLast = false,
  children,
}: ReceiptDetailProps) {
  const pillClass = validationStyles[validation] ?? "bg-[var(--color-surface-secondary)] text-[var(--color-ink-muted)] border-[var(--color-neutral-200)]";

  return (
    <div className={`px-6 py-5 ${!isLast ? "border-b border-[var(--color-neutral-200)]" : ""}`}>
      {/* ── Row header: index, type, amount, validation ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="font-editorial text-lg text-[var(--color-ink-muted)] tabular-nums w-6 text-right">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <p className="font-medium text-[var(--color-ink)]">{receiptTypeName}</p>
            <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">ID: {receiptId}</p>
          </div>
        </div>
        <span className="money-display text-lg text-[var(--color-ink)] tabular-nums">
          ${typeof amount === "number" ? amount.toLocaleString("es-MX", { minimumFractionDigits: 2 }) : amount}
        </span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${pillClass}`}>
          {validation}
        </span>
      </div>

      {/* ── Expandable fiscal detail ── */}
      {cfdi && (
        <details className="mt-3 ml-10">
          <summary className="text-xs font-medium text-primary-500 cursor-pointer hover:text-primary-600 transition-colors select-none">
            Detalle fiscal
          </summary>
          <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] overflow-hidden">
            {/* Emisor */}
            <div className="px-4 py-2.5 border-b border-[var(--color-neutral-100)] flex items-baseline justify-between gap-4">
              <span className="text-xs text-[var(--color-ink-muted)]">Emisor</span>
              <div className="text-right">
                <span className="text-sm text-[var(--color-ink)]">{cfdi.nombreEmisor}</span>
                <span className="block text-xs text-[var(--color-ink-muted)]">{cfdi.rfcEmisor}</span>
              </div>
            </div>

            {/* Fecha */}
            <div className="px-4 py-2.5 border-b border-[var(--color-neutral-100)] flex items-baseline justify-between gap-4">
              <span className="text-xs text-[var(--color-ink-muted)]">Fecha</span>
              <span className="text-sm text-[var(--color-ink)]">{fmtDate(cfdi.fechaEmision)}</span>
            </div>

            {/* Amounts grid */}
            <div className="grid grid-cols-3 text-center divide-x divide-[var(--color-neutral-100)] border-b border-[var(--color-neutral-100)]">
              <div className="px-3 py-2.5">
                <p className="text-[11px] text-[var(--color-ink-muted)] mb-0.5">Subtotal</p>
                <p className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">{fmtMoney(cfdi.subtotal, cfdi.moneda)}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[11px] text-[var(--color-ink-muted)] mb-0.5">IVA</p>
                <p className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">{fmtMoney(cfdi.iva, cfdi.moneda)}</p>
              </div>
              <div className="px-3 py-2.5 bg-primary-50/30">
                <p className="text-[11px] text-primary-500 mb-0.5 font-medium">Total</p>
                <p className="text-sm font-bold text-primary-600 tabular-nums">{fmtMoney(cfdi.total, cfdi.moneda)}</p>
              </div>
            </div>

            {/* Metadata footer */}
            <div className="px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-ink-muted)]">
              <span title={cfdi.uuid}>
                <strong className="text-[var(--color-ink-secondary)]">UUID:</strong>{" "}
                <code className="bg-[var(--color-surface-secondary)] px-1 py-0.5 rounded">{truncateUuid(cfdi.uuid)}</code>
              </span>
              <SatBadge estado={cfdi.satEstado} />
              {cfdi.moneda && cfdi.moneda !== "MXN" && (
                <span><strong className="text-[var(--color-ink-secondary)]">Moneda:</strong> {cfdi.moneda}</span>
              )}
            </div>
          </div>
        </details>
      )}

      {/* ── Document links + preview ── */}
      {(pdf || xml || receiptImage) && (
        <div className="mt-3 ml-10 flex flex-wrap items-center gap-2">
          {pdf && (
            <a
              href={`${apiBaseUrl}/files/receipt-file/${pdf.fileId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF: {pdf.fileName}
            </a>
          )}
          {xml && (
            <a
              href={`${apiBaseUrl}/files/receipt-file/${xml.fileId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              XML: {xml.fileName}
            </a>
          )}
          {receiptImage && (
            <a
              href={`${apiBaseUrl}/files/receipt-file/${receiptImage.fileId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              🖼️ Imagen: {receiptImage.fileName}
            </a>
          )}
        </div>
      )}

      {/* ── PDF inline preview (expandable) ── */}
      {pdf && (
        <details className="mt-2 ml-10">
          <summary className="text-[11px] text-[var(--color-ink-muted)] cursor-pointer hover:text-[var(--color-ink-secondary)] transition-colors select-none">
            Vista previa del PDF
          </summary>
          <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] overflow-hidden bg-[var(--color-surface-secondary)]">
            <iframe
              src={`${apiBaseUrl}/files/receipt-file/${pdf.fileId}`}
              title={`Preview ${pdf.fileName}`}
              className="w-full h-[400px] border-0"
            />
          </div>
        </details>
      )}

      {/* ── Actions slot (children) ── */}
      {children && (
        <div className="mt-3 ml-10 flex items-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
