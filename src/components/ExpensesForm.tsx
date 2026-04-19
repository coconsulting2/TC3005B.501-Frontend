import React, { useState, useRef } from "react";
import FileDropZone from "@components/FileDropZone";
import type { FileDropZoneHandle } from "@components/FileDropZone";
import Button from "@components/Button.tsx";
import { submitTravelExpense } from "@components/SubmitTravelWarper";
import ModalWrapper from "@components/ModalWrapper.tsx";
import { apiRequest } from "@utils/apiClient";

const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL;

interface Props {
  requestId: number;
  token: string;
  receiptToReplace?: string | null;
}

export default function ExpensesFormClient({ requestId, token, receiptToReplace }: Props) {
  const [concepto, setConcepto] = useState("Transporte");
  const [monto, setMonto] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [isInternational, setIsInternational] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const dropZoneRef = useRef<FileDropZoneHandle>(null);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      if (!concepto || !monto || isNaN(parseFloat(monto)) || !pdfFile || (!isInternational && !xmlFile)) {
        alert("Por favor, completa todos los campos correctamente.");
        setSubmitting(false);
        return;
      }

      // 1. Create the receipt record
      const { lastReceiptId } = await submitTravelExpense({
        requestId,
        concepto,
        monto: parseFloat(monto),
        token,
      });

      if (!lastReceiptId) {
        alert("No se pudo crear el comprobante.");
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
      await dropZoneRef.current!.upload(uploadUrl);

      // 4. Done — redirect
      window.location.href = `/comprobar-solicitud/${requestId}`;
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  };

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
            className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
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
        Es viaje internacional
      </label>

      {/* ── Drag & drop file zone ── */}
      <FileDropZone
        ref={dropZoneRef}
        token={token}
        isInternational={isInternational}
        onPdfChange={setPdfFile}
        onXmlChange={setXmlFile}
      />

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
          onConfirm={handleSubmit}
        >
          Subir Comprobante
        </ModalWrapper>
      </div>
    </div>
  );
}
