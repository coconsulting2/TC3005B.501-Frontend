/**
 * Normaliza filas de GET /accounts-payable/get-expense-validations/:id
 * y metadatos de /files/receipt-files/:id para ReceiptDetailCard.
 */
import type { ReceiptCfdi, ReceiptFile } from "@components/ReceiptDetailCard";
import { apiRequest } from "@/utils/apiClient";
import type { AstroCookies } from "astro";

export interface ExpenseValidationApiRow {
  receipt_id: number;
  receipt_type_name?: string;
  amount: number;
  validation: string;
  expense_status?: string;
  cfdi?: ReceiptCfdi | null;
}

export interface ReceiptDisplayRow {
  receipt_id: number;
  receipt_type_name: string;
  amount: number;
  validation: string;
  expense_status: string;
  cfdi: ReceiptCfdi | null;
  pdf: ReceiptFile | null;
  xml: ReceiptFile | null;
  receipt_image: ReceiptFile | null;
}

function asReceiptFile(value: unknown): ReceiptFile | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.fileId === "string" && typeof v.fileName === "string") {
    return { fileId: v.fileId, fileName: v.fileName };
  }
  return null;
}

function asReceiptCfdi(value: unknown): ReceiptCfdi | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.uuid !== "string") return null;
  return {
    nombreEmisor: String(v.nombreEmisor ?? ""),
    rfcEmisor: String(v.rfcEmisor ?? ""),
    fechaEmision: String(v.fechaEmision ?? ""),
    subtotal: Number(v.subtotal ?? 0),
    iva: Number(v.iva ?? 0),
    total: Number(v.total ?? 0),
    moneda: String(v.moneda ?? "MXN"),
    uuid: v.uuid,
    satEstado: String(v.satEstado ?? ""),
    tipoComprobante: String(v.tipoComprobante ?? ""),
  };
}

export async function enrichExpensesWithFiles(
  expenses: ExpenseValidationApiRow[],
  cookies: AstroCookies,
): Promise<ReceiptDisplayRow[]> {
  if (!expenses.length) return [];

  const enriched = await Promise.all(
    expenses.map(async (receipt) => {
      let fileMap: Record<string, unknown> | null = null;
      try {
        fileMap = await apiRequest(`/files/receipt-files/${receipt.receipt_id}`, {
          cookies,
        });
      } catch {
        fileMap = null;
      }
      return { receipt, fileMap };
    }),
  );

  return enriched.map(({ receipt, fileMap }) => ({
    receipt_id: Number(receipt.receipt_id),
    receipt_type_name: String(receipt.receipt_type_name ?? ""),
    amount: Number(receipt.amount),
    validation: String(receipt.validation ?? ""),
    expense_status: String(receipt.expense_status ?? ""),
    cfdi: asReceiptCfdi(receipt.cfdi),
    pdf: asReceiptFile(fileMap?.pdf),
    xml: asReceiptFile(fileMap?.xml),
    receipt_image: asReceiptFile(fileMap?.receipt_image),
  }));
}
