/**
 * Types for the expenses-by-cost-center dashboard (M3-009).
 *
 * Backend: GET /api/reports/expenses-by-cc?period=monthly|quarterly
 *   &from=YYYY-MM-DD&to=YYYY-MM-DD&expenseType=...&status=...&costCenterId=...
 * (el cliente usa `apiRequest("/reports/expenses-by-cc", …)` con base `/api`).
 *
 * Returning ExpenseReportResponse below (or an array of rows).
 */

export type ReportPeriod = "monthly" | "quarterly";

export const REPORT_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "paid",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Borrador",
  submitted: "Enviado",
  approved: "Aprobado",
  rejected: "Rechazado",
  paid: "Pagado",
};

export const REPORT_EXPENSE_TYPES = [
  "VIAJE_NACIONAL",
  "VIAJE_INTERNACIONAL",
  "HOSPEDAJE",
  "TRANSPORTE",
  "ALIMENTOS",
  "OTROS",
] as const;

export type ReportExpenseType = (typeof REPORT_EXPENSE_TYPES)[number];

export const REPORT_EXPENSE_TYPE_LABEL: Record<ReportExpenseType, string> = {
  VIAJE_NACIONAL: "Viaje nacional",
  VIAJE_INTERNACIONAL: "Viaje internacional",
  HOSPEDAJE: "Hospedaje",
  TRANSPORTE: "Transporte",
  ALIMENTOS: "Alimentos",
  OTROS: "Otros",
};

export interface ExpenseReportRow {
  cost_center_id: number;
  cost_center_code: string;
  cost_center_name: string;
  /** Period key — `YYYY-MM` when monthly, `YYYY-Qn` when quarterly. */
  period: string;
  amount: number;
  expense_type: ReportExpenseType;
  status: ReportStatus;
}

export interface CostCenterBudget {
  cost_center_id: number;
  cost_center_code: string;
  cost_center_name: string;
  /** Budget assigned for the active filter window, in MXN. */
  budget: number;
  /** Spent amount inside the same window, in MXN. */
  spent: number;
}

export interface ExpenseReportResponse {
  generated_at: string;
  rows: ExpenseReportRow[];
  budgets: CostCenterBudget[];
}

export interface ExpenseReportFilters {
  period: ReportPeriod;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  expenseTypes: ReportExpenseType[];
  statuses: ReportStatus[];
  costCenterIds: number[];
}

export interface BudgetAlert {
  cost_center_id: number;
  cost_center_code: string;
  cost_center_name: string;
  budget: number;
  spent: number;
  utilization: number;
  level: "warning" | "critical";
}

/** Threshold (% utilization) above which the dashboard surfaces an alert. */
export const ALERT_THRESHOLD = 0.8;
/** Above this threshold the alert is marked critical (over budget). */
export const CRITICAL_THRESHOLD = 1.0;

export function computeBudgetAlerts(
  budgets: CostCenterBudget[]
): BudgetAlert[] {
  return budgets
    .map((b) => {
      const utilization = b.budget > 0 ? b.spent / b.budget : 0;
      return { ...b, utilization };
    })
    .filter((b) => b.utilization >= ALERT_THRESHOLD)
    .map((b) => ({
      cost_center_id: b.cost_center_id,
      cost_center_code: b.cost_center_code,
      cost_center_name: b.cost_center_name,
      budget: b.budget,
      spent: b.spent,
      utilization: b.utilization,
      level: (b.utilization >= CRITICAL_THRESHOLD ? "critical" : "warning") as BudgetAlert["level"],
    }))
    .sort((a, b) => b.utilization - a.utilization);
}
