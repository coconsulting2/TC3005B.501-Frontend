/**
 * Author: Leonardo Rodriguez
 *
 * Description:
 * Modal component with overlay, escape key handler, and focus management.
 * Supports confirm, warning, error, and success types.
 * Uses design tokens for consistent styling.
 *
 * @param title - Modal title
 * @param message - Modal body message
 * @param type - Modal type for styling (confirm, warning, error, success)
 * @param show - Whether the modal is visible
 * @param onClose - Callback when modal is closed
 * @param onConfirm - Optional callback for confirmation action
 * @param confirmLabel - Custom confirm button text (default: "Confirmar")
 * @param cancelLabel - Custom cancel button text (default: "Cancelar")
 * @returns React Modal element
 */

import { useEffect, useRef, useCallback } from "react";
import { MODAL_STYLES } from "@config/modal";
import type { ModalType } from "@config/modal";

interface ModalProps {
  title: string;
  message: string;
  type?: ModalType;
  onClose: () => void;
  onConfirm?: () => void;
  show: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  children?: React.ReactNode;
}

export default function Modal({
  title,
  message,
  type = "confirm",
  onClose,
  onConfirm,
  show,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    if (!show) return;

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [show, handleEscape]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm p-4"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className={`rounded-lg border shadow-lg p-6 w-full max-w-md ${MODAL_STYLES[type]} text-black bg-white bg-opacity-50 backdrop-blur-sm`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-message"
      >
        <h2 id="modal-title" className="text-lg font-bold mb-2">
          {title}
        </h2>
        <p id="modal-message" className="mb-4 text-sm">
          {message}
        </p>
        {children}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-300 rounded-md hover:bg-neutral-400 text-sm font-medium transition-colors"
          >
            {cancelLabel}
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-secondary-300 text-white rounded-md hover:bg-secondary-400 text-sm font-medium transition-colors"
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
