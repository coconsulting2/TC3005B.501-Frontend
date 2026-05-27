import { useCallback, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import Modal from "@components/Modal";
import ModalWrapper from "@components/ModalWrapper";
import Toast from "@components/Toast";
import { getButtonClasses } from "@type/button";

interface Props {
  request_id: number;
  endpoint: string;
  /** ID del usuario autenticado (misma cookie `id` / sesión); la API usa :user_id, no role_id. */
  user_id: string;
  title: string;
  message: string;
  redirection: string;
  modal_type: "success" | "warning";
  children: React.ReactNode;
  token: string;
}

export default function TravelRequestActionWrapper({
  request_id,
  endpoint,
  user_id,
  title,
  message,
  redirection,
  modal_type,
  children,
  token,
}: Props) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const isDecline = endpoint.includes("decline-travel-request");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  const performAction = useCallback(
    async (commentText?: string) => {
      try {
        const url = `${endpoint}/${request_id}/${user_id}`;
        await apiRequest(url, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          ...(commentText ? { data: { comentario: commentText } } : {}),
        });

        if (endpoint.includes("authorize-travel-request")) {
          setToast({ message: 'Solicitud autorizada exitosamente.', type: 'success' });
        } else if (isDecline) {
          setToast({ message: 'Solicitud rechazada exitosamente.', type: 'success' });
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (redirection) {
          window.location.href = redirection;
        } else {
          window.location.reload();
        }
      } catch (error) {
        console.error("Error en la solicitud:", error);
        const detail = error && typeof error === "object" && "detail" in error
          ? (error as { detail?: { response?: { error?: string } } }).detail
          : undefined;
        const msg =
          detail?.response && typeof detail.response.error === "string"
            ? detail.response.error
            : "No se pudo completar la acción. Intenta de nuevo.";
        setToast({ message: msg, type: "error" });
      }
    },
    [request_id, endpoint, redirection, user_id, token, isDecline],
  );

  const handleConfirmDecline = useCallback(async () => {
    const c = comment.trim();
    if (!c) {
      setToast({
        message: "El comentario es obligatorio para rechazar.",
        type: "error",
      });
      return;
    }
    setRejectOpen(false);
    setComment("");
    await performAction(c);
  }, [comment, performAction]);

  const handleApproveConfirm = useCallback(async () => {
    await performAction();
  }, [performAction]);

  if (isDecline) {
    const dangerBtn = getButtonClasses({
      variant: "filled",
      color: "danger",
      size: "medium",
    });
    return (
      <>
        <button
          type="button"
          onClick={() => setRejectOpen(true)}
          className={`${dangerBtn} pointer-events-auto transition-transform duration-200 hover:scale-105 min-h-11 min-w-11`}
        >
          {children}
        </button>

        <Modal
          title={title}
          message="Indique el motivo del rechazo (obligatorio)."
          type="warning"
          show={rejectOpen}
          onClose={() => {
            setRejectOpen(false);
            setComment("");
          }}
          onConfirm={handleConfirmDecline}
          confirmLabel="Rechazar"
        >
          <label
            className="block text-sm text-[var(--color-ink-secondary)] mb-1"
            htmlFor={`reject-comment-${request_id}`}
          >
            Comentario
          </label>
          <textarea
            id={`reject-comment-${request_id}`}
            className="w-full min-h-[100px] border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] p-2 text-sm"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Motivo del rechazo…"
          />
        </Modal>

        {toast && <Toast message={toast.message} type={toast.type} />}
      </>
    );
  }

  return (
    <>
      <ModalWrapper
        title={title}
        message={message}
        button_type={modal_type === "warning" ? "danger" : modal_type}
        modal_type={modal_type}
        onConfirm={handleApproveConfirm}
      >
        {children}
      </ModalWrapper>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}