import React, { useState, useCallback } from "react";
import Button from "@components/Button";
import Modal from "@components/Modal";
import ExpenseSettlementSummary from "@components/ExpenseSettlementSummary";
import type { ExpenseSettlement } from "@/utils/expenseSettlement";
import { apiRequest } from "@utils/apiClient";
import { showAppAlert, showAppAlertAsync } from "@utils/appAlert";

interface Props {
  requestId: number;
  redirectTo?: string;
  token: string;
  settlement: ExpenseSettlement;
}

export default function FinishRequestButton({
  requestId,
  redirectTo = "/dashboard",
  token,
  settlement,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const finalize = useCallback(async () => {
    try {
      await apiRequest(`/accounts-payable/validate-receipts/${requestId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      await showAppAlertAsync(
        "Lote marcado como listo para pago. La solicitud quedó finalizada.",
        { variant: "success" },
      );
      window.location.href = redirectTo;
    } catch (error) {
      console.error("Error al finalizar la solicitud", error);
      showAppAlert("Error al finalizar la solicitud.", { variant: "error" });
    }
  }, [requestId, redirectTo, token]);

  const allReviewed = settlement.pendingCount === 0;
  const canFinalize = allReviewed && settlement.approvedCount > 0;

  return (
    <>
      <Button
        color="success"
        size="medium"
        disabled={!allReviewed}
        onClick={() => setConfirmOpen(true)}
      >
        Terminar — listo para pago
      </Button>

      {confirmOpen && (
        <Modal
          title="Resumen final — listo para pago"
          message="Confirma que el cálculo de liquidación es correcto."
          type="confirm"
          onConfirm={canFinalize ? finalize : undefined}
          onClose={() => setConfirmOpen(false)}
          show={confirmOpen}
          confirmLabel="Marcar listo para pago"
        >
          <ExpenseSettlementSummary settlement={settlement} variant="final" />
          {allReviewed && settlement.approvedCount === 0 && (
            <p className="text-sm text-[var(--color-accent-500)] mt-3">
              No hay comprobantes aprobados. Si rechazaste todo el lote, no uses
              Terminar; el solicitante deberá corregir y reenviar.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
