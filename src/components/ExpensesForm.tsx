import React, { useState, useRef } from "react";
import FileDropZone from "@components/FileDropZone";
import type { FileDropZoneHandle, ReceiptUploadResponse } from "@components/FileDropZone";
import { isDevTaxPreviewEnabled } from "@components/CfdiDevPreview";
import UploadSuccessCard from "@components/UploadSuccessCard";
import Button from "@components/Button.tsx";
import { submitTravelExpense } from "@components/SubmitTravelWarper";
import ModalWrapper from "@components/ModalWrapper.tsx";
import PolicyAlert from "@components/PolicyAlert";
import PolicyExceptionModal from "@components/PolicyExceptionModal";
import { apiRequest } from "@utils/apiClient";
import { extractCfdiTotalFromXml, extractCfdiUuidFromXml } from "@utils/cfdiXml";
import { showAppAlert } from "@utils/appAlert";

// Mapping concepto (label) → receiptTypeId del seed (M2-006).
const CONCEPTO_TO_RECEIPT_TYPE_ID: Record<string, number> = {
  "Hospedaje": 1,
  "Comida": 2,
  "Transporte": 3,
  "Caseta": 4,
  "Autobús": 5,
  "Vuelo": 6,
  "Otro": 7,
};

interface PolicyPreviewResult {
  exceeded: boolean;
  policyId: number | null;
  capId: number | null;
  capAmount: number | null;
  capUnit: string | null;
  currency: string;
  excessTotal: number;
  message: string;
}

const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL;

function formatRegistroError(err: unknown): string {
  if (err && typeof err === "object" && "detail" in err) {
    const d = (err as { detail?: unknown }).detail;
    if (d && typeof d === "object" && "response" in d) {
      const r = (d as { response?: { error?: string; details?: string; message?: string } }).response;
      if (r && typeof r === "object") {
        if (typeof r.error === "string") return r.error;
        if (typeof r.details === "string") return r.details;
        if (typeof r.message === "string") return r.message;
      }
    }
    if (d && typeof d === "object" && "status" in d) {
      return `Error HTTP ${(d as { status: number }).status} al registrar CFDI`;
    }
  }
  return "No se pudo registrar el CFDI (SAT o validación en servidor)";
}

function formatCreateReceiptError(err: unknown): string {
  if (err && typeof err === "object" && "detail" in err) {
    const d = (err as { detail?: { response?: unknown; status?: number } }).detail;
    const r = d?.response;
    if (r && typeof r === "object" && r !== null && "error" in r && typeof (r as { error: string }).error === "string") {
      return (r as { error: string }).error;
    }
    if (typeof d?.status === "number") return `Error ${d.status} al crear el comprobante.`;
  }
  return "No se pudo crear el comprobante. Revisa la conexión o vuelve a intentar.";
}

interface Props {
  requestId: number;
  token: string;
  receiptToReplace?: string | null;
}

export default function ExpensesFormClient({ requestId, token, receiptToReplace }: Props) {
  const [concepto, setConcepto] = useState("Transporte");
  const [monto, setMonto] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [isInternational, setIsInternational] = useState(false);
  const [intlCurrency, setIntlCurrency] = useState<"USD" | "EUR" | "GBP" | "JPY" | "CAD">("USD");
  const [fechaComprobante, setFechaComprobante] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [submitting, setSubmitting] = useState(false);
  const [devUploadResult, setDevUploadResult] = useState<ReceiptUploadResponse | null>(null);
  const [devReceiptId, setDevReceiptId] = useState<number | null>(null);
  const [devRegistroResponse, setDevRegistroResponse] = useState<unknown | null>(null);
  const [devRegistroError, setDevRegistroError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [completedConcepto, setCompletedConcepto] = useState("");
  // M2-006 RF-44 — preview de política y modal de excepción
  const [policyPreview, setPolicyPreview] = useState<PolicyPreviewResult | null>(null);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionAuthorized, setExceptionAuthorized] = useState(false);

  const dropZoneRef = useRef<FileDropZoneHandle>(null);
  const showDevPanel = isDevTaxPreviewEnabled();

  /**
   * Llama POST /policies/preview para validar el gasto contra la política aplicable.
   * Si exceeded y aún no se justificó, abre el modal y retorna false (bloquea submit).
   */
  async function checkPolicyBeforeSubmit(): Promise<boolean> {
    if (exceptionAuthorized) return true;
    const receiptTypeId = CONCEPTO_TO_RECEIPT_TYPE_ID[concepto];
    if (!receiptTypeId) return true;
    try {
      const result = await apiRequest<PolicyPreviewResult>("/policies/preview", {
        method: "POST",
        data: {
          requestId,
          receiptTypeId,
          amount: parseFloat(monto),
          currency: isInternational ? intlCurrency : "MXN",
        },
      });
      setPolicyPreview(result);
      if (result.exceeded) {
        setShowExceptionModal(true);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("policy preview failed (allowing submit):", e);
      return true; // No bloqueamos por fallo de preview — el backend revalida.
    }
  }

  const onXmlFileChange = (file: File | null) => {
    setXmlFile(file);
    if (!file || isInternational) return;
    void (async () => {
      try {
        const text = await file.text();
        const total = extractCfdiTotalFromXml(text);
        if (total != null) {
          setMonto(total.toFixed(2));
        }
      } catch {
        /* XML no legible: el usuario sigue pudiendo escribir el monto a mano */
      }
    })();
  };

  const handleSubmit = async () => {
    try {
      setShowValidation(true);
      setSubmitting(true);
      setDevUploadResult(null);
      setDevReceiptId(null);
      setDevRegistroResponse(null);
      setDevRegistroError(null);

      const getValidationErrors = (): string[] => {
        const errors: string[] = [];

        if (!concepto) errors.push("El concepto es obligatorio.");
        if (!monto) errors.push("El monto gastado es obligatorio.");
        else if (isNaN(parseFloat(monto))) errors.push("El monto gastado debe ser un número válido.");

        if (!pdfFile) {
          errors.push(
              isInternational
                  ? "Debes adjuntar el comprobante en JPG o PNG."
                  : "Debes adjuntar el comprobante en PDF."
          );
        }

        if (!isInternational && !xmlFile) errors.push("Debes adjuntar el archivo XML.");

        return errors;
      };

      const errors: string[] = getValidationErrors();
      if (errors.length > 0) {
        showAppAlert(errors.join(" "), { variant: "warning" });
        setSubmitting(false);
        return;
      }

      if (isInternational) {
        const ymd = fechaComprobante?.trim() ?? "";
        if (!ymd) {
          showAppAlert("La fecha del comprobante es obligatoria para recibos internacionales.", {
            variant: "warning",
          });
          setSubmitting(false);
          return;
        }
        const emisionIntl = new Date(`${ymd}T12:00:00`);
        if (Number.isNaN(emisionIntl.getTime())) {
          showAppAlert("La fecha del comprobante no es válida. Elige una fecha en el calendario.", {
            variant: "warning",
          });
          setSubmitting(false);
          return;
        }
      }

      // M2-006 RF-44 — pre-evaluar contra política antes de subir nada.
      const policyOk = await checkPolicyBeforeSubmit();
      if (!policyOk) {
        setSubmitting(false);
        return; // El modal solicitará justificación; al aprobar, el usuario reintenta el submit.
      }

      let cfdiUuid: string | null = null;
      if (!isInternational && xmlFile) {
        const xmlText = await xmlFile.text();
        cfdiUuid = extractCfdiUuidFromXml(xmlText);
        if (!cfdiUuid) {
          showAppAlert("No se pudo leer el UUID del XML. Verifica que sea un CFDI con TimbreFiscalDigital válido.", {
            variant: "error",
          });
          setSubmitting(false);
          return;
        }
      }

      let lastReceiptId: number | null = null;
      try {
        const res = await submitTravelExpense({
          requestId,
          concepto,
          monto: parseFloat(monto),
          token,
          cfdiUuid: cfdiUuid ?? undefined,
          allowMissingCfdiUuid: isInternational,
        });
        lastReceiptId = res.lastReceiptId;
      } catch (createErr) {
        showAppAlert(formatCreateReceiptError(createErr), { variant: "error" });
        setSubmitting(false);
        return;
      }

      if (!lastReceiptId) {
        showAppAlert("No se pudo crear el comprobante.", { variant: "error" });
        setSubmitting(false);
        return;
      }

      // 2. If replacing an old receipt, delete it first
      if (receiptToReplace) {
        try {
          await apiRequest(`/applicant/delete-receipt/${receiptToReplace}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (delErr) {
          console.error("Error eliminando comprobante anterior:", delErr);
        }
      }

      // 3. Upload files via FileDropZone's imperative handle (real progress bar)
      const uploadUrl = `${API_BASE_URL}/files/upload-receipt-files/${lastReceiptId}`;
      const uploadRes = await dropZoneRef.current!.upload(uploadUrl);

      if (isInternational) {
        const ymd = fechaComprobante.trim();
        const emisionIntl = new Date(`${ymd}T12:00:00`);
        try {
          await apiRequest(`/comprobantes/${lastReceiptId}`, {
            method: "POST",
            data: {
              is_international: true,
              descripcion: `${concepto} — comprobante internacional`,
              total: parseFloat(monto),
              moneda: intlCurrency,
              fecha_emision: emisionIntl.toISOString(),
              receipt_type_id: CONCEPTO_TO_RECEIPT_TYPE_ID[concepto],
            },
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (regErr) {
          console.error(regErr);
          const msg = formatRegistroError(regErr);
          showAppAlert(msg, { variant: "error" });
          setSubmitting(false);
          return;
        }
      } else if (uploadRes.registro_sugerido && typeof uploadRes.registro_sugerido === "object") {
        try {
          const regRes = await apiRequest(`/comprobantes/${lastReceiptId}`, {
            method: "POST",
            data: uploadRes.registro_sugerido,
            headers: { Authorization: `Bearer ${token}` },
          });
          if (showDevPanel) {
            setDevRegistroResponse(regRes);
          }
        } catch (regErr) {
          console.error(regErr);
          const msg = formatRegistroError(regErr);
          setDevRegistroError(msg);
          showAppAlert(msg, { variant: "error" });
          if (showDevPanel) {
            setDevUploadResult(uploadRes);
            setDevReceiptId(lastReceiptId);
          }
          setSubmitting(false);
          return;
        }
      }

      setDevUploadResult(uploadRes);
      setDevReceiptId(lastReceiptId);
      setCompletedConcepto(concepto);
      setUploadSuccess(true);
      setSubmitting(false);
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  };

  if (uploadSuccess) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-secondary)] p-6">
        <UploadSuccessCard
          requestId={requestId}
          receiptId={devReceiptId ?? 0}
          concepto={completedConcepto}
          apiBaseUrl={API_BASE_URL}
          uploadResult={devUploadResult}
          registroResponse={devRegistroResponse as Record<string, unknown> | null}
          registroError={devRegistroError}
          isInternational={isInternational}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Form fields ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label
            htmlFor="concepto"
            className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]"
          >
            Concepto
          </label>
          <select
            id="concepto"
            name="concepto"
            className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
          >
            <option>Transporte</option>
            <option>Hospedaje</option>
            <option>Comida</option>
            <option>Caseta</option>
            <option>Autobús</option>
            <option>Vuelo</option>
            <option>Otro</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="monto"
            className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]"
          >
            Monto
          </label>
          <input
            id="monto"
            type="number"
            step="0.01"
            className={`${
              showValidation && (!monto || isNaN(parseFloat(monto)))
                ? "w-full border border-accent-400 rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
                : "w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
            }`}
            placeholder="Ej. 443.50"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
        </div>
      </div>

      {/* ── International toggle ── */}
      <label className="flex items-center gap-2 text-sm text-[var(--color-ink-secondary)] cursor-pointer">
        <input
          type="checkbox"
          checked={isInternational}
          onChange={(e) => setIsInternational(e.target.checked)}
          className="accent-primary-400"
        />
        Es en moneda extranjera
      </label>

      {isInternational && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="intlCurrency"
              className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]"
            >
              Moneda del recibo
            </label>
            <select
              id="intlCurrency"
              className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)]"
              value={intlCurrency}
              onChange={(e) =>
                setIntlCurrency(e.target.value as typeof intlCurrency)
              }
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
              <option value="CAD">CAD</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="fechaComprobante"
              className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]"
            >
              Fecha del gasto
            </label>
            <input
              id="fechaComprobante"
              type="date"
              className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)]"
              value={fechaComprobante}
              onChange={(e) => setFechaComprobante(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Drag & drop file zone ── */}
      <FileDropZone
        ref={dropZoneRef}
        token={token}
        isInternational={isInternational}
        onPdfChange={setPdfFile}
        onXmlChange={onXmlFileChange}
        className={showValidation ? "show-missing" : ""}
      />

      {/* M2-006 RF-44 — Alerta de política. Solo visible cuando hay preview que excedió. */}
      {policyPreview && (
        <PolicyAlert
          exceeded={policyPreview.exceeded && !exceptionAuthorized}
          capAmount={policyPreview.capAmount}
          capUnit={policyPreview.capUnit}
          currency={policyPreview.currency}
          message={policyPreview.message}
          onJustify={() => setShowExceptionModal(true)}
        />
      )}

      {/* ── Actions ── */}
      <div className="flex justify-end gap-4 pt-4">
        <a href={`/comprobar-solicitud/${requestId}`}>
          <Button type="button" variant="border" color="danger">
            Cancelar
          </Button>
        </a>
        <ModalWrapper
          title="Subir comprobación"
          message="¿Está seguro de que desea subir este Comprobante?"
          modal_type="confirm"
          button_type="primary"
          variant="filled"
          disabled={submitting}
          onConfirm={handleSubmit}
        >
          Subir Comprobante
        </ModalWrapper>
      </div>

      {policyPreview && (
        <PolicyExceptionModal
          open={showExceptionModal}
          onClose={() => setShowExceptionModal(false)}
          requestId={requestId}
          policyId={policyPreview.policyId}
          capId={policyPreview.capId}
          amountClaimed={parseFloat(monto) || 0}
          excessAmount={policyPreview.excessTotal}
          onCreated={() => {
            setExceptionAuthorized(true);
            showAppAlert(
              "Justificación enviada. Vuelve a presionar 'Subir Comprobante' para completar el registro.",
              { variant: "info" },
            );
          }}
        />
      )}
    </div>
  );
}
