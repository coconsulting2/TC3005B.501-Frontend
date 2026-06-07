/**
 * Textos de ayuda contextual para el panel de reglas de workflow.
 */
import type { WfParamType } from "@type/WorkflowRuleTypes";

export const WORKFLOW_RULE_FIELD_HELP = {
  ruleType:
    "Pre-aprobación: se evalúa cuando la solicitud se envía y define la cadena de aprobación. Post-comprobación: se evalúa al validar comprobantes después del viaje.",
  paramType:
    "La condición que dispara esta regla. Ej.: Importe evalúa el monto del anticipo; Destino evalúa el país de destino del viaje.",
  threshold:
    "Tope de la banda en MXN. El motor elige la banda más pequeña donde el monto del anticipo sea menor o igual al umbral. Ese umbral define el nivel máximo de aprobación.",
  skipIfBelow:
    "Si el anticipo es menor a este monto, el flujo empieza en el nivel de esta regla (puede saltar N1 u otros niveles inferiores). No significa que la regla «no aplique».",
  approvalLevel:
    "Nivel de la cadena de aprobación que activa esta regla. 1 = jefe directo (N1), 2 = jefe de área (N2), etc.",
  managerSteps:
    "Cuántos niveles de jefe por encima del solicitante deben aprobar. Ej.: 2 = su jefe y el jefe de su jefe.",
  targetRole:
    "Envía la solicitud a un rol fijo para aprobación, sin importar la jerarquía. Ej.: Cuentas por pagar para validación financiera.",
  department:
    "Limita esta regla a un departamento específico. Si se deja Global, aplica a toda la organización.",
  priority:
    "Orden en la tabla del administrador. No cambia qué regla gana al evaluar el motor hoy.",
} as const;

const PARAM_VALUE_HELP: Record<WfParamType, string> = {
  importe: "",
  nivel:
    "Nivel organizacional del solicitante (número). La regla aplica cuando coincide con el valor indicado.",
  gasto:
    "ID del tipo de comprobante o gasto. La regla aplica si el viaje incluye ese tipo de gasto.",
  destino:
    "ID del país de destino. La regla aplica si algún tramo del viaje tiene ese destino.",
  moneda:
    "Código ISO de moneda (ej. USD, MXN). La regla aplica si el anticipo está en esa moneda.",
};

/**
 * @param paramType
 */
export function getParamValueHelp(paramType: WfParamType): string {
  return PARAM_VALUE_HELP[paramType] ?? "Valor específico de la condición seleccionada.";
}
