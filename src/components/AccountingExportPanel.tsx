/**
 * AccountingExportPanel — Exportación contable para ERP (M1-010).
 *
 * Consulta GET /api/export/contable y muestra vista previa. El backend devuelve
 * pólizas en formato SAP (header + detalle con SHKZG, AMT_DOCCUR, GL_ACCOUNT…);
 * aquí se normalizan a la forma de presentación.
 */

import { useCallback, useRef, useState, type SVGProps } from "react";
import Button from "@components/Button";
import Toast from "@components/Toast";

interface PolizaHeader {
  ID_VIAJE?: string;
  DOC_TYPE?: string;
  HEADER_TXT?: string;
  PSTNG_DATE?: string;
  CURRENCY?: string;
  COMP_CODE?: string;
  [key: string]: unknown;
}

interface Poliza {
  requestId?: number;
  docType?: string;
  polizaIndex?: number;
  header?: PolizaHeader;
  detalle?: Record<string, unknown>[];
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
}

interface ExportResponse {
  polizas: Poliza[];
}

/* ── Iconos SVG (currentColor); no dependen de la fuente Material Icons ── */

function IconSearch({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function IconDownload({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function IconAlertCircle({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function IconArchive({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
      />
    </svg>
  );
}

function IconChevronDown({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function IconChevronUp({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function IconJson({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function formatMoney(value: number | undefined, currency = "MXN"): string {
  if (value == null || Number.isNaN(value)) return "—";
  try {
    return value.toLocaleString("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });
  } catch {
    return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${currency}`;
  }
}

function sharedDocCurrency(detalles: PolizaDetalle[]): string | undefined {
  const codes = detalles
    .map((d) => (typeof d.currency === "string" && d.currency.trim() ? d.currency.trim() : null))
    .filter((c): c is string => Boolean(c));
  if (codes.length === 0) return "MXN";
  const uniq = [...new Set(codes)];
  return uniq.length === 1 ? uniq[0] : undefined;
}

function formatTotalAmount(value: number, detalles: PolizaDetalle[]): string {
  const shared = sharedDocCurrency(detalles);
  if (shared) return formatMoney(value, shared);
  return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2 })} (varias monedas)`;
}

/** Convierte una línea SAP / mixta al modelo que usa la tabla. */
function mapDetalleLine(
  line: Record<string, unknown>,
  headerCurrency: string,
): PolizaDetalle {
  const shkzg = String(line.SHKZG ?? line.indicatorDebitCredit ?? "").trim();
  const amtRaw = line.AMT_DOCCUR ?? line.amountDocCurrency;
  const amt = typeof amtRaw === "number" ? amtRaw : Number(amtRaw);
  return {
    glAccount: String(line.GL_ACCOUNT ?? line.glAccount ?? "").trim() || undefined,
    glAccountName:
      typeof line.glAccountName === "string" && line.glAccountName.trim()
        ? line.glAccountName.trim()
        : undefined,
    indicatorDebitCredit: shkzg === "S" || shkzg === "H" ? shkzg : undefined,
    amountDocCurrency: Number.isFinite(amt) ? amt : 0,
    currency:
      String(line.CURRENCY ?? line.currency ?? (headerCurrency || "MXN")).trim() || "MXN",
    costCenter: (() => {
      const s = String(line.COSTCENTER ?? line.costCenter ?? "").trim();
      return s || undefined;
    })(),
    itemText: (() => {
      const s = String(line.ITEM_TEXT ?? line.itemText ?? "").trim();
      return s || undefined;
    })(),
  };
}

/** Une respuesta del API (detalle + keys SAP) con campos útiles para UI y descarga. */
function enrichPolizaForUi(p: Poliza, listIndex: number): Poliza {
  const header = (p.header ?? {}) as PolizaHeader;
  const headerCurrency = typeof header.CURRENCY === "string" ? header.CURRENCY : "MXN";
  const rawLines = (p.detalle ?? p.detalles ?? []) as unknown[];
  const lines = Array.isArray(rawLines)
    ? rawLines.map((row) => mapDetalleLine(row as Record<string, unknown>, headerCurrency))
    : [];

  const idStr = header.ID_VIAJE != null ? String(header.ID_VIAJE).trim() : "";
  let requestId = p.requestId;
  if (requestId == null && idStr !== "" && !Number.isNaN(Number(idStr))) {
    requestId = Number(idStr);
  }

  const docType = String(p.docType ?? header.DOC_TYPE ?? "").trim() || "—";
  const polizaIndex = typeof p.polizaIndex === "number" ? p.polizaIndex : listIndex;

  return {
    ...p,
    requestId,
    docType,
    polizaIndex,
    detalles: lines,
  };
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
    id: number;
  } | null>(null);
  const toastIdRef = useRef(0);
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
      const normalized = (data.polizas ?? []).map((p, i) => enrichPolizaForUi(p, i));
      setPolizas(normalized);
      setFetched(true);

      if (normalized.length === 0) {
        toastIdRef.current += 1;
        setToast({
          message: "No se encontraron pólizas en ese rango de fechas.",
          type: "info",
          id: toastIdRef.current,
        });
      } else {
        toastIdRef.current += 1;
        setToast({
          message: `${normalized.length} póliza(s) obtenida(s).`,
          type: "success",
          id: toastIdRef.current,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toastIdRef.current += 1;
      setToast({ message: `Error: ${msg}`, type: "error", id: toastIdRef.current });
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
    toastIdRef.current += 1;
    setToast({ message: "Archivo JSON descargado.", type: "success", id: toastIdRef.current });
  }, [polizas, dateFrom, dateTo]);

  const toggleExpand = (idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} key={toast.id} />}

      <section
        className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] p-4 sm:p-5 shadow-[var(--shadow-sm)]"
        aria-label="Filtros de exportación"
      >
        <p className="eyebrow mb-4">Rango de fechas</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-12 lg:items-end lg:gap-x-4">
          <div className="min-w-0 sm:col-span-1 lg:col-span-2">
            <label
              htmlFor="export-date-from"
              className="mb-1 block text-xs text-[var(--color-ink-muted)]"
            >
              Desde
            </label>
            <input
              id="export-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full min-w-0 border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          </div>
          <div className="min-w-0 sm:col-span-1 lg:col-span-2">
            <label
              htmlFor="export-date-to"
              className="mb-1 block text-xs text-[var(--color-ink-muted)]"
            >
              Hasta
            </label>
            <input
              id="export-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full min-w-0 border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          </div>

          <div className="flex min-h-[44px] min-w-0 items-center gap-3 sm:col-span-2 lg:col-span-5">
            <input
              id="export-include-synced"
              type="checkbox"
              checked={includeSynced}
              onChange={(e) => setIncludeSynced(e.target.checked)}
              className="size-5 shrink-0 cursor-pointer rounded border-[var(--color-neutral-300)] text-primary-500 focus:ring-2 focus:ring-primary-200 focus:ring-offset-0"
            />
            <label
              htmlFor="export-include-synced"
              className="min-w-0 cursor-pointer text-base font-medium leading-snug text-[var(--color-ink-secondary)]"
            >
              Incluir ya sincronizados
            </label>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
            <Button
              type="button"
              variant="filled"
              color="primary"
              size="big"
              onClick={fetchPolizas}
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2.5">
                  <span
                    className="inline-block size-5 shrink-0 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden
                  />
                  <span className="text-base leading-none">Consultando…</span>
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2.5">
                  <IconSearch className="size-5 shrink-0 opacity-95" aria-hidden />
                  <span className="text-base leading-none font-semibold">Consultar</span>
                </span>
              )}
            </Button>

            {polizas.length > 0 && (
              <Button
                type="button"
                variant="border"
                color="primary"
                size="big"
                onClick={downloadJSON}
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <IconDownload className="size-5 shrink-0" aria-hidden />
                  <span className="text-base leading-none font-semibold">Descargar JSON</span>
                </span>
              </Button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-accent-400 bg-accent-50 p-4 text-sm text-accent-500 flex items-start gap-2.5">
          <IconAlertCircle className="size-5 shrink-0 mt-0.5 text-accent-500" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {fetched && polizas.length === 0 && !error && (
        <div
          role="status"
          className="block w-full min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] px-4 py-8 sm:px-8 sm:py-10"
        >
          <IconArchive
            className="mx-auto mb-4 block size-14 shrink-0 text-[var(--color-neutral-300)]"
            aria-hidden
          />
          <p className="w-full min-w-0 whitespace-normal break-words text-left text-base leading-relaxed text-[var(--color-ink-muted)]">
            <span className="font-medium text-[var(--color-ink-secondary)]">
              No hay pólizas pendientes de exportar en este rango.
            </span>{" "}
            Activa &quot;Incluir ya sincronizados&quot; para ver lotes previamente exportados, o amplía las
            fechas (el filtro usa la fecha de validación del comprobante aprobado).
          </p>
        </div>
      )}

      {polizas.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Pólizas"
              value={String(polizas.length)}
              detail={`${dateFrom} → ${dateTo}`}
            />
            <KpiCard
              label="Solicitudes"
              value={String(new Set(polizas.map((p) => p.requestId).filter((id) => id != null)).size)}
              detail="Viajes distintos"
            />
            <KpiCard
              label="Líneas totales"
              value={String(polizas.reduce((sum, p) => sum + (p.detalles?.length ?? 0), 0))}
              detail="Partidas contables"
            />
            <KpiCard label="Estado" value="Listo" detail="Vista alineada al JSON del API" variant="success" />
          </div>

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

function KpiCard({
  label,
  value,
  detail,
  variant = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  variant?: "default" | "success" | "warning";
}) {
  const valueColor =
    variant === "success"
      ? "text-success-500"
      : variant === "warning"
        ? "text-warning-500"
        : "text-[var(--color-ink)]";
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] px-4 py-4 shadow-[var(--shadow-sm)]">
      <p className="eyebrow mb-1">{label}</p>
      <p className={`text-2xl font-light leading-tight tabular-nums ${valueColor}`}>{value}</p>
      {detail && <p className="mt-1.5 text-xs text-[var(--color-ink-muted)] leading-snug">{detail}</p>}
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
  const header = (poliza.header ?? {}) as PolizaHeader;
  const detalles = poliza.detalles ?? [];
  const totalDebe = detalles
    .filter((d) => d.indicatorDebitCredit === "S")
    .reduce((sum, d) => sum + (d.amountDocCurrency ?? 0), 0);
  const totalHaber = detalles
    .filter((d) => d.indicatorDebitCredit === "H")
    .reduce((sum, d) => sum + (d.amountDocCurrency ?? 0), 0);

  const viajeLabel =
    poliza.requestId != null ? String(poliza.requestId) : header.ID_VIAJE != null ? String(header.ID_VIAJE) : "—";
  const titulo =
    typeof header.HEADER_TXT === "string" && header.HEADER_TXT.trim()
      ? header.HEADER_TXT.trim()
      : `Póliza ${poliza.docType ?? "—"}`;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] overflow-hidden shadow-[var(--shadow-sm)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[var(--color-surface-secondary)] transition-colors cursor-pointer text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary-50 text-primary-600 text-xs font-semibold shrink-0 tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--color-ink)] leading-snug">
              Viaje <span className="tabular-nums">#{viajeLabel}</span>
              <span className="text-[var(--color-ink-muted)] font-normal"> · {poliza.docType ?? "—"}</span>
            </p>
            <p className="text-xs text-[var(--color-ink-secondary)] mt-0.5 truncate" title={titulo}>
              {titulo}
            </p>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              {detalles.length} partida{detalles.length !== 1 ? "s" : ""} · Debe{" "}
              {formatTotalAmount(totalDebe, detalles)} · Haber {formatTotalAmount(totalHaber, detalles)}
            </p>
          </div>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-neutral-200)] bg-[var(--color-surface-white)] text-[var(--color-ink-muted)]">
          {isExpanded ? (
            <IconChevronUp className="size-5" aria-hidden />
          ) : (
            <IconChevronDown className="size-5" aria-hidden />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--color-neutral-200)] bg-[var(--color-surface-secondary)]/40">
          {detalles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-neutral-200)]">
                    <th className="text-left px-3 py-2.5 font-medium text-[var(--color-ink-secondary)]">
                      Cuenta
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-[var(--color-ink-secondary)]">
                      Nombre
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] w-24">
                      D/H
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] whitespace-nowrap">
                      Monto
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] w-20">
                      Moneda
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] w-28">
                      CC
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-[var(--color-ink-secondary)] min-w-[140px]">
                      Texto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d, i) => {
                    const dh = d.indicatorDebitCredit;
                    const dhLabel =
                      dh === "S" ? "Debe" : dh === "H" ? "Haber" : dh ? String(dh) : "—";
                    return (
                      <tr
                        key={i}
                        className="border-b border-[var(--color-neutral-100)] odd:bg-[var(--color-surface-white)] even:bg-[var(--color-surface-secondary)]/50 hover:bg-primary-50/30 transition-colors"
                      >
                        <td className="px-3 py-2.5 tabular-nums font-medium text-[var(--color-ink)]">
                          {d.glAccount ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-ink-secondary)] max-w-[200px] truncate">
                          {d.glAccountName ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              dh === "S"
                                ? "bg-primary-50 text-primary-600"
                                : dh === "H"
                                  ? "bg-accent-50 text-accent-500"
                                  : "bg-[var(--color-neutral-200)] text-[var(--color-ink-muted)]"
                            }`}
                          >
                            {dhLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[var(--color-ink)] whitespace-nowrap">
                          {formatMoney(d.amountDocCurrency, d.currency ?? "MXN")}
                        </td>
                        <td className="px-3 py-2.5 text-center text-[var(--color-ink-muted)] tabular-nums">
                          {d.currency ?? "MXN"}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-ink-secondary)] tabular-nums">
                          {d.costCenter ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-ink-muted)] max-w-[280px] truncate" title={d.itemText}>
                          {d.itemText ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--color-neutral-300)] bg-[var(--color-surface-secondary)]">
                    <td colSpan={2} className="px-3 py-2.5 font-medium text-[var(--color-ink)]">
                      Totales
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-primary-50 text-primary-600">
                        Debe
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[var(--color-ink)]">
                      {formatTotalAmount(totalDebe, detalles)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                  <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-neutral-200)]">
                    <td colSpan={2} className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-accent-50 text-accent-500">
                        Haber
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[var(--color-ink)]">
                      {formatTotalAmount(totalHaber, detalles)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="p-4 text-sm text-[var(--color-ink-muted)]">Póliza sin partidas de detalle.</p>
          )}

          <details className="border-t border-[var(--color-neutral-200)] bg-[var(--color-surface-white)]">
            <summary className="px-4 py-2.5 text-xs text-[var(--color-ink-muted)] cursor-pointer hover:bg-[var(--color-surface-secondary)] transition-colors select-none font-medium inline-flex items-center gap-2 w-full list-none [&::-webkit-details-marker]:hidden">
              <IconJson className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden />
              Ver JSON crudo (SAP)
            </summary>
            <pre className="px-4 py-3 text-[11px] leading-relaxed text-[var(--color-ink-secondary)] bg-[var(--color-surface-secondary)] overflow-x-auto max-h-[280px] border-t border-[var(--color-neutral-100)]">
              {JSON.stringify(
                { header: poliza.header, detalle: poliza.detalle ?? poliza.detalles },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
