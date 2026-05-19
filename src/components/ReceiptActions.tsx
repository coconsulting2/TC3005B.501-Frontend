import AproveReceipStatus from "@components/AproveReceiptsModal";
import RejectReceipStatus from "@components/RejectReceiptsModal";

interface ReceiptProps {
  receipt_id: number;
  request_id: number;
  receipt_type_name?: string;
  disabled: boolean;
  expense_status?: string;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  token: string;
}

export default function ReceiptActions({
  receipt_id,
  request_id,
  receipt_type_name,
  disabled,
  token,
}: ReceiptProps) {
  return (
    <div className="flex flex-row gap-2 items-center justify-center w-full">
      <AproveReceipStatus
        receipt_id={receipt_id}
        title="Aprobar comprobante"
        message="¿Está seguro de que deseas aprobar este comprobante?"
        redirection="/dashboard"
        modal_type="success"
        variant="filled"
        disabled={disabled}
        token={token}
      >
        Aprobar
      </AproveReceipStatus>

      <RejectReceipStatus
        receipt_id={receipt_id}
        request_id={request_id}
        receipt_type_name={receipt_type_name}
        disabled={disabled}
        token={token}
      >
        Rechazar
      </RejectReceipStatus>
    </div>
  );
}
