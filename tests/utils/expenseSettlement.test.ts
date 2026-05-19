import { describe, expect, it } from "vitest";
import { computeExpenseSettlement, resolveAdvanceReference } from "@/utils/expenseSettlement";

describe("expenseSettlement", () => {
  it("el saldo se calcula contra anticipo solicitado aunque haya impuesto", () => {
    const ref = resolveAdvanceReference({ requested_fee: 5000, imposed_fee: 4500 });
    expect(ref.amount).toBe(5000);
    expect(ref.label).toBe("Anticipo solicitado");
    expect(ref.imposedFee).toBe(4500);
  });

  it("calcula reembolso cuando gastos aprobados superan anticipo", () => {
    const s = computeExpenseSettlement(
      [
        { receipt_id: 1, receipt_type_name: "Hotel", amount: 3000, validation: "Aprobado" },
        { receipt_id: 2, receipt_type_name: "Comida", amount: 2000, validation: "Aprobado" },
      ],
      { requested_fee: 4000, imposed_fee: 4000 },
    );
    expect(s.approvedTotal).toBe(5000);
    expect(s.balance).toBe(1000);
    expect(s.balanceKind).toBe("reembolso");
    expect(s.approvedLines).toHaveLength(2);
  });

  it("ignora pendientes y rechazados en el total", () => {
    const s = computeExpenseSettlement(
      [
        { receipt_id: 1, receipt_type_name: "A", amount: 1000, validation: "Aprobado" },
        { receipt_id: 2, receipt_type_name: "B", amount: 500, validation: "Pendiente" },
        { receipt_id: 3, receipt_type_name: "C", amount: 9000, validation: "Rechazado" },
      ],
      { requested_fee: 1000, imposed_fee: null },
    );
    expect(s.approvedTotal).toBe(1000);
    expect(s.pendingCount).toBe(1);
    expect(s.rejectedCount).toBe(1);
    expect(s.balanceKind).toBe("cuadrado");
  });
});
