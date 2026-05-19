import React from "react";
import AproveReceipStatus from "@components/AproveReceiptsModal";
import RejectReceipStatus from "@components/RejectReceiptsModal";

interface ReceiptProps {
  receipt_id: number;
  expense_status?: string;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  token: string;
}

export default function ReceiptActions({
  receipt_id,
  onApprove,
  onReject,
  token,
}: ReceiptProps) {
  const handleApproveSuccess = () => {
    onApprove?.(receipt_id);
  };

  const handleRejectSuccess = () => {
    onReject?.(receipt_id);
  };

  return (
    <div className="flex flex-row gap-2 items-center justify-center w-full">
      <AproveReceipStatus
        receipt_id={receipt_id}
        title="Aprobar comprobante"
        message="¿Está seguro de que deseas aprobar este comprobante?"
        redirection=""
        modal_type="success"
        variant="filled"
        token={token}
        onSuccess={handleApproveSuccess}
      >
        Aprobar
      </AproveReceipStatus>

      <RejectReceipStatus
        receipt_id={receipt_id}
        title="Rechazar comprobante"
        message="¿Está seguro de que deseas rechazar este comprobante?"
        redirection=""
        modal_type="warning"
        variant="filled"
        token={token}
        onSuccess={handleRejectSuccess}
      >
        Rechazar
      </RejectReceipStatus>
    </div>
  );
}
