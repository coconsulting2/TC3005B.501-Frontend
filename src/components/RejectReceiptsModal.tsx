import React, { useCallback, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import Modal from "@components/Modal";
import Toast from "@components/Toast";
import { getButtonClasses } from "@type/button";

function mensajeErrorApi(error: unknown): string {
  if (!error || typeof error !== "object" || !("detail" in error)) {
    return "No se pudo rechazar el comprobante.";
  }
  const d = (error as { detail?: unknown }).detail;
  if (!d || typeof d !== "object" || !("response" in d)) {
    return "No se pudo rechazar el comprobante.";
  }
  const r = (d as { response?: { error?: string } }).response;
  if (r && typeof r.error === "string" && r.error.trim()) return r.error;
  return "No se pudo rechazar el comprobante.";
}

interface Props {
  receipt_id: number;
  request_id: number;
  receipt_type_name?: string;
  token: string;
  disabled?: boolean;
  children: React.ReactNode;
  onSuccess?: () => void;
}

export default function RejectReceipStatus({
  receipt_id,
  request_id,
  receipt_type_name,
  token,
  disabled = false,
  children,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleConfirm = useCallback(async () => {
    const c = comment.trim();
    if (!c) {
      setToast({
        message: "El comentario es obligatorio para rechazar.",
        type: "error",
      });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/accounts-payable/validate-receipt/${receipt_id}`, {
        method: "PUT",
        data: { approval: 0, comentario: c },
        headers: { Authorization: `Bearer ${token}` },
      });
      setOpen(false);
      setComment("");
      setToast({ message: "Comprobante rechazado.", type: "success" });
      if (onSuccess) {
        onSuccess();
      } else {
        await new Promise((r) => setTimeout(r, 1200));
        window.location.reload();
      }
    } catch (error) {
      console.error("Error en la solicitud:", error);
      setToast({ message: mensajeErrorApi(error), type: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [receipt_id, token, comment, onSuccess]);

  const btnClass = getButtonClasses({
    variant: "filled",
    color: "danger",
    size: "medium",
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        className={`${btnClass} pointer-events-auto transition-transform duration-200 hover:scale-105 min-h-11 min-w-11`}
        style={disabled ? { opacity: 0.5, pointerEvents: "none" } : undefined}
        disabled={disabled}
      >
        {children}
      </button>

      <Modal
        title="Rechazar comprobante"
        message="Indique el motivo del rechazo. El comentario quedará visible en el chat de la solicitud para el solicitante."
        type="warning"
        show={open}
        onClose={() => {
          if (!submitting) {
            setOpen(false);
            setComment("");
          }
        }}
        onConfirm={submitting ? undefined : handleConfirm}
        confirmLabel={submitting ? "Guardando…" : "Rechazar"}
      >
        <label
          className="block text-sm text-[var(--color-ink-secondary)] mb-1"
          htmlFor={`reject-receipt-${receipt_id}`}
        >
          Comentario (obligatorio)
        </label>
        <textarea
          id={`reject-receipt-${receipt_id}`}
          className="w-full min-h-[100px] border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] p-2 text-sm text-[var(--color-ink)]"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            receipt_type_name
              ? `Motivo del rechazo de ${receipt_type_name}…`
              : "Motivo del rechazo…"
          }
          disabled={submitting}
        />
        <p className="text-xs text-[var(--color-ink-muted)] mt-2">
          Solicitud #{request_id} · también puedes escribir en el chat más abajo.
        </p>
      </Modal>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.type === "error" ? 5000 : 3500}
        />
      )}
    </>
  );
}
