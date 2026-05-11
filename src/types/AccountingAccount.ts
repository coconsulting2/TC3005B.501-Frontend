/**
 * Accounting catalog types — accounting accounts, tax indicators, receipt
 * types and the mapping that ties each ReceiptType to a cargo/abono account.
 *
 * Used by /admin/catalogo-contable, /admin/indicadores-impuesto and
 * /admin/mapeo-gastos. Backend ownership lives in Prisma models
 * AccountingAccount, TaxIndicator and ExpenseTypeMapping, all filtered by
 * orgId.
 */

export type AccountingAccountType = "ANTICIPOS" | "GASTOS" | "ACREEDORES";

export const ACCOUNT_TYPES: AccountingAccountType[] = [
  "ANTICIPOS",
  "GASTOS",
  "ACREEDORES",
];

export const ACCOUNT_TYPE_LABEL: Record<AccountingAccountType, string> = {
  ANTICIPOS: "Anticipos",
  GASTOS: "Gastos",
  ACREEDORES: "Acreedores",
};

export interface AccountingAccount {
  accounting_account_id: number;
  org_id: number;
  account_number: string;
  description: string;
  type: AccountingAccountType;
  currency: string;
  active?: boolean;
}

export type TaxIndicatorType =
  | "IVA_TRASLADADO"
  | "IVA_RETENIDO"
  | "ISR_RETENIDO";

export const TAX_INDICATOR_TYPES: TaxIndicatorType[] = [
  "IVA_TRASLADADO",
  "IVA_RETENIDO",
  "ISR_RETENIDO",
];

export const TAX_INDICATOR_TYPE_LABEL: Record<TaxIndicatorType, string> = {
  IVA_TRASLADADO: "IVA trasladado",
  IVA_RETENIDO: "IVA retenido",
  ISR_RETENIDO: "ISR retenido",
};

export interface TaxIndicator {
  tax_indicator_id: number;
  org_id: number;
  key: string;
  description: string;
  percentage: number;
  type: TaxIndicatorType;
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
  description: string;
  type: AccountingAccountType;
  currency: string;
}

export type AccountingAccountFormErrors = Partial<
  Record<keyof AccountingAccountFormValues, string>
>;

export interface TaxIndicatorFormValues {
  key: string;
  description: string;
  percentage: string;
  type: TaxIndicatorType;
}

export type TaxIndicatorFormErrors = Partial<
  Record<keyof TaxIndicatorFormValues, string>
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

export const COMMON_CURRENCIES = ["MXN", "USD", "EUR", "CAD", "GBP"] as const;

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

/**
 * Returns the ids of tax indicators that are referenced by at least one
 * active mapping. The catalogue UI uses this to block deletion.
 */
export function getMappedTaxIndicatorIds(
  mappings: ExpenseTypeMapping[]
): Set<number> {
  const ids = new Set<number>();
  mappings.forEach((m) => {
    if (m.active === false) return;
    if (m.tax_indicator_id != null) ids.add(m.tax_indicator_id);
  });
  return ids;
}
