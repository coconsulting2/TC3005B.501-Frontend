/**
 * Accounting catalog types — accounting accounts, tax indicators, receipt
 * types and the mapping that ties each ReceiptType to a cargo/abono account.
 *
 * Used by /admin/catalogo-contable and /admin/mapeo-gastos.
 * Backend ownership lives in Prisma models AccountingAccount, TaxIndicator
 * and ExpenseTypeMapping, all filtered by orgId.
 */

export type AccountingAccountType = "cargo" | "abono" | "ambos";

export interface AccountingAccount {
  accounting_account_id: number;
  org_id: number;
  account_number: string;
  name: string;
  type: AccountingAccountType;
  active?: boolean;
}

export interface TaxIndicator {
  tax_indicator_id: number;
  org_id: number;
  code: string;
  name: string;
  rate: number;
  active?: boolean;
}

export interface ReceiptType {
  receipt_type_id: number;
  name: string;
  description?: string;
}

export interface ExpenseTypeMapping {
  expense_type_mapping_id: number;
  org_id: number;
  receipt_type_id: number;
  cargo_account_id: number;
  abono_account_id: number;
  tax_indicator_id: number | null;
  active?: boolean;
}

export interface AccountingAccountFormValues {
  account_number: string;
  name: string;
  type: AccountingAccountType;
}

export type AccountingAccountFormErrors = Partial<
  Record<keyof AccountingAccountFormValues, string>
>;

export interface ExpenseTypeMappingFormValues {
  receipt_type_id: number | null;
  cargo_account_id: number | null;
  abono_account_id: number | null;
  tax_indicator_id: number | null;
}

export type ExpenseTypeMappingFormErrors = Partial<
  Record<keyof ExpenseTypeMappingFormValues, string>
>;

/**
 * Returns the ids of accounts that are referenced by at least one active
 * mapping. The catalogue UI uses this to block deletion.
 */
export function getMappedAccountIds(
  mappings: ExpenseTypeMapping[]
): Set<number> {
  const ids = new Set<number>();
  mappings.forEach((m) => {
    if (m.active === false) return;
    ids.add(m.cargo_account_id);
    ids.add(m.abono_account_id);
  });
  return ids;
}

export const ACCOUNT_TYPE_LABEL: Record<AccountingAccountType, string> = {
  cargo: "Cargo",
  abono: "Abono",
  ambos: "Cargo y abono",
};
