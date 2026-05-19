/**
 * Liquidación CxP: comprobantes aprobados vs anticipo de la solicitud.
 */

export interface SettlementReceiptLine {
  receipt_id: number;
  receipt_type_name: string;
  amount: number;
}

export interface TravelAdvanceFees {
  requested_fee?: number | null;
  imposed_fee?: number | null;
}

export interface ExpenseSettlement {
  /** Monto contra el que se calcula el saldo (autorizado si existe, si no solicitado). */
  advanceAmount: number;
  advanceLabel: string;
  requestedFee: number;
  imposedFee: number | null;
  approvedTotal: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  approvedLines: SettlementReceiptLine[];
  /** Total aprobado − anticipo de referencia. */
  balance: number;
  balanceKind: "reembolso" | "devolucion" | "cuadrado";
  balanceDescription: string;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveAdvanceReference(fees: TravelAdvanceFees): {
  amount: number;
  label: string;
  requestedFee: number;
  imposedFee: number | null;
} {
  const requestedFee = roundMoney(Number(fees.requested_fee) || 0);
  const imposedRaw = fees.imposed_fee;
  const imposedNum =
    imposedRaw != null && Number(imposedRaw) > 0 ? roundMoney(Number(imposedRaw)) : null;

  return {
    amount: requestedFee,
    label: "Anticipo solicitado",
    requestedFee,
    imposedFee: imposedNum,
  };
}

export function computeExpenseSettlement(
  receipts: Array<{
    receipt_id: number;
    receipt_type_name: string;
    amount: number;
    validation: string;
  }>,
  fees: TravelAdvanceFees,
): ExpenseSettlement {
  const advance = resolveAdvanceReference(fees);
  const approved = receipts.filter((r) => r.validation === "Aprobado");
  const approvedTotal = roundMoney(
    approved.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
  );
  const balance = roundMoney(approvedTotal - advance.amount);

  let balanceKind: ExpenseSettlement["balanceKind"];
  let balanceDescription: string;

  if (balance > 0) {
    balanceKind = "reembolso";
    balanceDescription =
      "El empleado gastó más que el anticipo; la empresa debe reembolsar la diferencia.";
  } else if (balance < 0) {
    balanceKind = "devolucion";
    balanceDescription =
      "El empleado comprobó menos que el anticipo; corresponde devolución a la empresa.";
  } else {
    balanceKind = "cuadrado";
    balanceDescription = "Los gastos aprobados coinciden con el anticipo.";
  }

  return {
    advanceAmount: advance.amount,
    advanceLabel: advance.label,
    requestedFee: advance.requestedFee,
    imposedFee: advance.imposedFee,
    approvedTotal,
    approvedCount: approved.length,
    pendingCount: receipts.filter((r) => r.validation === "Pendiente").length,
    rejectedCount: receipts.filter((r) => r.validation === "Rechazado").length,
    approvedLines: approved.map((r) => ({
      receipt_id: r.receipt_id,
      receipt_type_name: r.receipt_type_name,
      amount: roundMoney(Number(r.amount) || 0),
    })),
    balance,
    balanceKind,
    balanceDescription,
  };
}

export function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
}
