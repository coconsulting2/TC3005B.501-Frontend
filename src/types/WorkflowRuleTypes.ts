/**
 * Types for the Workflow Rules admin panel.
 * Mirrors the response from GET /api/workflow-rules.
 */

export type WfRuleType = "pre" | "post";
export type WfParamType = "importe" | "nivel" | "gasto" | "destino" | "moneda";

export interface WorkflowRuleDTO {
  id: string;
  ruleType: WfRuleType;
  paramType: WfParamType;
  threshold: number | null;
  paramValue: string | null;
  approvalLevel: number;
  skipIfBelow: number | null;
  priority: number;
  active: boolean;
  departmentId: number | null;
  departmentName?: string | null;
  costsCenter?: string | null;
  managerSteps: number | null;
  targetRole: string | null;
  createdAt?: string;
}

/** Payload para crear/editar (sin id ni active). */
export type WorkflowRuleFormData = Omit<
  WorkflowRuleDTO,
  "id" | "active" | "createdAt" | "departmentName" | "costsCenter"
>;

export interface WorkflowRulePreviewRequest {
  amount: number;
  ruleType?: WfRuleType;
  departmentId?: number | null;
  currency?: string;
  destinationCountryIds?: number[];
  receiptTypeIds?: number[];
  orgLevel?: number | null;
  draftRule?: WorkflowRuleFormData;
  editingRuleId?: string;
}

export interface WorkflowRulePreviewResponse {
  levels: number[];
  minApprovalLevel: number;
  maxApprovalLevel: number;
  skipApplied: boolean;
  initialStatusId: number;
  initialStatusLabel: string;
  summary: string;
  hints: string[];
  matchedImportBand?: { threshold: number; approvalLevel: number } | null;
  targetRole?: string | null;
  amountEvaluated: number;
  currencyEvaluated: string;
}
