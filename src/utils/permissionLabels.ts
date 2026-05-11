/**
 * Etiquetas legibles para permisos (catálogo global).
 * El backend suele guardar description = "resource:action" igual que code; aquí el texto para personas no técnicas.
 */

/** code → frase en español para UI */
const PERMISSION_LABEL_ES: Record<string, string> = {
  // Solicitudes de viaje
  "travel_request:create": "Crear nuevas solicitudes de viaje",
  "travel_request:view_own": "Ver solo sus propias solicitudes de viaje",
  "travel_request:view_any": "Ver todas las solicitudes de viaje de la organización",
  "travel_request:edit_own": "Editar sus propias solicitudes de viaje",
  "travel_request:submit": "Enviar solicitudes a revisión o siguiente etapa",
  "travel_request:cancel": "Cancelar solicitudes de viaje",
  "travel_request:authorize": "Autorizar o rechazar solicitudes de viaje",

  "travel_agent:attend": "Atender solicitudes como agencia de viajes",

  "accounts_payable:attend": "Atender solicitudes en cuentas por pagar",
  "accounting:export": "Exportar información contable",

  "receipt:upload": "Subir comprobantes de gasto",
  "receipt:delete_own": "Eliminar sus propios comprobantes",
  "receipt:validate": "Validar comprobantes de gasto",
  "receipt:view_sat": "Consultar datos fiscales del comprobante (SAT)",

  "expense:view": "Ver gastos y reglas de políticas",
  "expense:submit": "Registrar gastos del viaje",
  "expense:authorize_exception": "Autorizar excepciones a las políticas de gasto",

  "authorizer:view_alerts": "Ver alertas como autorizador",

  "user:view_self": "Ver su propio perfil y datos",
  "user:list": "Ver el listado de usuarios de la organización",
  "user:create": "Crear nuevos usuarios en la organización",
  "user:edit": "Editar datos de otros usuarios",
  "user:manage_permissions": "Asignar permisos directamente a usuarios",

  "permission:read": "Consultar el catálogo de permisos del sistema",
  "permission:write": "Crear o modificar permisos del catálogo",
  "permission_group:manage": "Administrar grupos de permisos",
  "role:manage_permissions": "Configurar permisos y grupos dentro de cada rol",

  "policy:read": "Ver políticas de gasto",
  "policy:manage": "Crear y editar políticas de gasto",

  "api_key:manage": "Administrar llaves API para integraciones",

  "organization:create": "Crear nuevas organizaciones (tenant)",
  "organization:list_all": "Ver todas las organizaciones del sistema",
  "organization:read": "Ver información de organizaciones",
  "organization:update": "Modificar datos de organizaciones",
  "organization:activate": "Activar organizaciones",
  "organization:suspend": "Suspender organizaciones",
  "organization:impersonate": "Trabajar en nombre de otra organización (suplantación)",
  "organization:manage_any": "Administrar cualquier organización",

  "integration:read": "Ver configuración de integraciones",
  "integration:write": "Configurar integraciones",

  "accounting_catalog:read": "Ver catálogo contable",
  "accounting_catalog:write": "Editar catálogo contable",

  "notification_template:read": "Ver plantillas de notificación",
  "notification_template:write": "Editar plantillas de notificación",

  "receipt_type:write": "Configurar tipos de comprobante",
  "alert_message:write": "Configurar mensajes de alerta",

  "onboarding:import": "Importar usuarios desde archivo (onboarding)",
};

function looksLikeTechnicalDescription(desc: string, code: string): boolean {
  const t = desc.trim();
  if (!t || t === code) return true;
  // seed usa a veces "resource:action" sin repetir code exacto
  if (/^[\w]+:[\w_]+$/.test(t)) return true;
  return false;
}

function genericFallback(code: string): string {
  const idx = code.indexOf(":");
  if (idx === -1) return `Permiso: ${code}`;
  const resource = code.slice(0, idx).replace(/_/g, " ");
  const action = code.slice(idx + 1).replace(/_/g, " ");
  return `Permiso sobre «${resource}»: ${action}`;
}

export interface PermissionCatalogItemLike {
  code: string;
  action: string;
  description: string | null;
}

/**
 * Título para mostrar a administradores; el código sigue disponible como referencia técnica.
 */
export function getPermissionFriendlyLabel(item: PermissionCatalogItemLike): {
  headline: string;
  /** Si conviene mostrar el código debajo (casi siempre sí para soporte / auditoría). */
  showTechnicalRef: boolean;
} {
  const mapped = PERMISSION_LABEL_ES[item.code];
  if (mapped) {
    return { headline: mapped, showTechnicalRef: true };
  }

  const d = item.description?.trim() ?? "";
  if (d && !looksLikeTechnicalDescription(d, item.code)) {
    return { headline: d, showTechnicalRef: true };
  }

  return {
    headline: genericFallback(item.code),
    showTechnicalRef: true,
  };
}
