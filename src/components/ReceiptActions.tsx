import AproveReceipStatus from "@components/AproveReceiptsModal";
import RejectReceipStatus from "@components/RejectReceiptsModal";

interface ReceiptProps {
  receipt_id: number;
  request_id: number;
  receipt_type_name?: string;
  disabled?: boolean;
  expense_status?: string;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  token: string;
}

export default function ReceiptActions({
  receipt_id,
  request_id,
  receipt_type_name,
  disabled = false,
  token,
  onApprove,
  onReject,
}: ReceiptProps) {
  const handleApproveSuccess = () => {
    if (onApprove) {
      onApprove(receipt_id);
    } else {
      window.location.reload();
    }
  };

  const handleRejectSuccess = () => {
    if (onReject) {
      onReject(receipt_id);
    } else {
      window.location.reload();
    }
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
        disabled={disabled}
        token={token}
        onSuccess={handleApproveSuccess}
      >
        Aprobar
      </AproveReceipStatus>

      <RejectReceipStatus
        receipt_id={receipt_id}
        request_id={request_id}
        receipt_type_name={receipt_type_name}
        disabled={disabled}
        token={token}
        onSuccess={handleRejectSuccess}
      >
        Rechazar
      </RejectReceipStatus>
    </div>
  );
}
