/**
 * Panel solo desarrollo: mapeo fiscal desde XML (respuesta de upload) y,
 * si hubo POST /comprobantes, contraste con lo persistido / SAT.
 */
import type { ReceiptUploadResponse } from "@components/FileDropZone";

export function isDevTaxPreviewEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  const v = import.meta.env.PUBLIC_IS_DEV;
  return v === true || v === "true";
}

interface Props {
  requestId: number;
  receiptId: number;
  apiBaseUrl: string;
  upload: ReceiptUploadResponse;
  registroResponse: unknown | null;
  registroError: string | null;
}

function formatFecha(value: string | Date | undefined): string {
  if (value == null) return "—";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export default function CfdiDevPreview({
  requestId,
  receiptId,
  apiBaseUrl,
  upload,
  registroResponse,
  registroError,
}: Props) {
  const cfdi = upload.cfdi;
  const pdfHref =
    upload.pdf != null ? `${apiBaseUrl}/files/receipt-file/${upload.pdf.fileId}` : null;
  const xmlHref =
    upload.xml != null ? `${apiBaseUrl}/files/receipt-file/${upload.xml.fileId}` : null;
  const imageHref =
    upload.receipt_image != null
      ? `${apiBaseUrl}/files/receipt-file/${upload.receipt_image.fileId}`
      : null;

  return (
    <section
      className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-primary-300 bg-primary-50/20 p-4 text-left"
      aria-label="Vista desarrollo CFDI"
    >
      <h3 className="text-sm font-semibold text-primary-600 mb-2">
        Desarrollo — datos fiscales (origen: XML)
      </h3>
      <p className="text-xs text-[var(--color-ink-muted)] mb-4">
        El PDF es solo respaldo. Los montos y RFCs mostrados aquí salen del XML parseado en el servidor.
      </p>

      {cfdi ? (
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full text-xs border border-[var(--color-neutral-200)] rounded-md">
            <tbody className="divide-y divide-[var(--color-neutral-200)]">
              <Row label="UUID" value={cfdi.uuid} />
              <Row label="Versión" value={cfdi.version} />
              <Row label="RFC emisor" value={cfdi.rfcEmisor} />
              <Row label="RFC receptor" value={cfdi.rfcReceptor ?? "—"} />
              <Row label="Fecha" value={formatFecha(cfdi.fecha)} />
              <Row label="Total" value={String(cfdi.total)} />
              <Row label="Sello (últimos 8)" value={cfdi.selloUltimos8 ?? "—"} />
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-ink-muted)] mb-4">Sin objeto `cfdi` en la respuesta.</p>
      )}

      {cfdi?.taxes != null && (
        <details className="mb-4 text-xs">
          <summary className="cursor-pointer font-medium text-[var(--color-ink-secondary)]">
            Impuestos (traslados / retenciones)
          </summary>
          <pre className="mt-2 p-2 bg-[var(--color-surface-secondary)] rounded-md overflow-x-auto max-h-40">
            {JSON.stringify(cfdi.taxes, null, 2)}
          </pre>
        </details>
      )}

      <div className="text-xs space-y-2 mb-4">
        {upload.international && (
          <p className="text-[var(--color-ink-muted)] mb-2">
            Subida internacional (sin par PDF/XML clásico).
          </p>
        )}
        {pdfHref ? (
          <p>
            <span className="font-medium text-[var(--color-ink-secondary)]">PDF (respaldo):</span>{" "}
            <a href={pdfHref} className="text-primary-500 hover:underline break-all" target="_blank" rel="noreferrer">
              Descargar PDF
            </a>
          </p>
        ) : imageHref ? (
          <p>
            <span className="font-medium text-[var(--color-ink-secondary)]">Imagen del recibo:</span>{" "}
            <a
              href={imageHref}
              className="text-primary-500 hover:underline break-all"
              target="_blank"
              rel="noreferrer"
            >
              Descargar imagen
            </a>
          </p>
        ) : (
          <p className="text-[var(--color-ink-muted)]">Sin archivo PDF/XML en la respuesta.</p>
        )}
        {xmlHref ? (
          <p>
            <span className="font-medium text-[var(--color-ink-secondary)]">XML:</span>{" "}
            <a href={xmlHref} className="text-primary-500 hover:underline break-all" target="_blank" rel="noreferrer">
              Descargar XML
            </a>
          </p>
        ) : null}
      </div>

      {upload.registro_sugerido != null && (
        <details className="mb-3 text-xs">
          <summary className="cursor-pointer font-medium text-[var(--color-ink-secondary)]">
            Cuerpo sugerido para POST /comprobantes/{receiptId}
          </summary>
          <pre className="mt-2 p-2 bg-[var(--color-surface-secondary)] rounded-md overflow-x-auto max-h-48">
            {JSON.stringify(upload.registro_sugerido, null, 2)}
          </pre>
        </details>
      )}

      {registroError && (
        <p className="text-xs text-accent-600 mb-2">
          <strong>Error al registrar:</strong> {registroError}
        </p>
      )}

      {registroResponse != null && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-[var(--color-ink-secondary)]">
            Respuesta POST /comprobantes (persistido / SAT)
          </summary>
          <pre className="mt-2 p-2 bg-[var(--color-surface-secondary)] rounded-md overflow-x-auto max-h-48">
            {JSON.stringify(registroResponse, null, 2)}
          </pre>
        </details>
      )}

      <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
        Solicitud #{requestId} · Receipt #{receiptId}
      </p>
      <a
        href={`/comprobar-solicitud/${requestId}`}
        className="inline-block mt-3 text-sm font-medium text-primary-500 hover:text-primary-600"
      >
        Ir a comprobar solicitud →
      </a>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th className="text-left px-2 py-1.5 bg-[var(--color-surface-secondary)] font-medium text-[var(--color-ink-secondary)] w-36">
        {label}
      </th>
      <td className="px-2 py-1.5 text-[var(--color-ink)] break-all">{value}</td>
    </tr>
  );
}
