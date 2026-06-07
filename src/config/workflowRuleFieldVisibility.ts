/**
 * Qué campos del modal de reglas son visibles según paramType.
 */
import type { WfParamType } from "@type/WorkflowRuleTypes";

export type WfFormFieldKey =
  | "threshold"
  | "paramValue"
  | "skipIfBelow"
  | "approvalLevel"
  | "managerSteps"
  | "targetRole"
  | "departmentId"
  | "priority";

const ALWAYS: WfFormFieldKey[] = [
  "approvalLevel",
  "managerSteps",
  "targetRole",
  "departmentId",
  "priority",
];

const BY_PARAM: Record<WfParamType, WfFormFieldKey[]> = {
  importe: ["threshold", "skipIfBelow", ...ALWAYS],
  nivel: ["paramValue", ...ALWAYS],
  gasto: ["paramValue", ...ALWAYS],
  destino: ["paramValue", ...ALWAYS],
  moneda: ["paramValue", ...ALWAYS],
};

/**
 * @param paramType
 */
export function visibleFieldsForParamType(paramType: WfParamType): Set<WfFormFieldKey> {
  return new Set(BY_PARAM[paramType] ?? ALWAYS);
}

/**
 * @param paramType
 * @param field
 */
export function isFieldVisible(paramType: WfParamType, field: WfFormFieldKey): boolean {
  return visibleFieldsForParamType(paramType).has(field);
}
