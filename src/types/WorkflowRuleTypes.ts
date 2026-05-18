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
