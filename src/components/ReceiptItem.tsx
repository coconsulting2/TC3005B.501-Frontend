/**
 * ReceiptItem — Wrapper React que maneja el estado local de un comprobante
 * Envuelve ReceiptDetailCard + ReceiptActions y mantiene validation sincronizado
 * (avoiding un-necessary reloads and providing context per comprobante)
 */

import React, { useState } from "react";
import ReceiptDetailCard, { type ReceiptDetailProps } from "@components/ReceiptDetailCard";
import ReceiptActions from "@components/ReceiptActions";

interface ReceiptItemProps extends Omit<ReceiptDetailProps, "children"> {
  token: string;
}

export default function ReceiptItem({
  receiptId,
  token,
  ...cardProps
}: ReceiptItemProps) {
  // Validation actualizado localmente sin recargar
  const [currentValidation, setCurrentValidation] = useState(cardProps.validation);

  const handleApproveSuccess = () => {
    setCurrentValidation("Aprobado");
  };

  const handleRejectSuccess = () => {
    setCurrentValidation("Rechazado");
  };

  const isReviewable = currentValidation === "Pendiente";

  return (
    <ReceiptDetailCard
      {...cardProps}
      validation={currentValidation}
      receiptId={receiptId}
    >
      {isReviewable && (
        <div className="mt-3 ml-10 flex items-center gap-3">
          <ReceiptActions
            receipt_id={receiptId}
            token={token}
            onApprove={handleApproveSuccess}
            onReject={handleRejectSuccess}
          />
        </div>
      )}
    </ReceiptDetailCard>
  );
}



