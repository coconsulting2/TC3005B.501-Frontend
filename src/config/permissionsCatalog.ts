/**
 * Permissions catalog grouped by module. Seed used by the roles admin view
 * until the backend exposes a real catalog endpoint (M2-00x).
 */

export interface Permission {
  code: string;
  label: string;
  description?: string;
}

export interface PermissionModule {
  key: string;
  label: string;
  permissions: Permission[];
}

export const PERMISSIONS_CATALOG: PermissionModule[] = [
  {
    key: "viajes",
    label: "Viajes",
    permissions: [
      { code: "viajes.solicitud.crear", label: "Crear solicitud de viaje" },
      { code: "viajes.solicitud.editar", label: "Editar solicitud propia" },
      { code: "viajes.solicitud.cancelar", label: "Cancelar solicitud" },
      { code: "viajes.autorizar.n1", label: "Autorizar nivel 1" },
      { code: "viajes.autorizar.n2", label: "Autorizar nivel 2" },
      { code: "viajes.cotizar", label: "Cotizar / atender (agencia)" },
    ],
  },
  {
    key: "gastos",
    label: "Gastos y comprobantes",
    permissions: [
      { code: "gastos.comprobante.subir", label: "Subir comprobantes" },
      { code: "gastos.comprobante.validar", label: "Validar comprobantes" },
      { code: "gastos.aprobar", label: "Aprobar gastos" },
      { code: "gastos.rechazar", label: "Rechazar gastos" },
      { code: "gastos.reembolso", label: "Procesar reembolsos" },
      { code: "gastos.excepcion.autorizar", label: "Autorizar excepciones de política" },
    ],
  },
  {
    key: "usuarios",
    label: "Usuarios",
    permissions: [
      { code: "usuarios.ver", label: "Ver usuarios" },
      { code: "usuarios.crear", label: "Crear usuarios" },
      { code: "usuarios.editar", label: "Editar usuarios" },
      { code: "usuarios.eliminar", label: "Eliminar usuarios" },
    ],
  },
  {
    key: "catalogos",
    label: "Catálogos",
    permissions: [
      { code: "catalogos.centros.gestionar", label: "Gestionar centros de costos" },
      { code: "catalogos.departamentos.gestionar", label: "Gestionar departamentos" },
      { code: "catalogos.politicas.gestionar", label: "Gestionar políticas" },
      { code: "catalogos.politicas.ver", label: "Ver políticas de viaje" },
      { code: "catalogos.categorias-empleado.gestionar", label: "Gestionar categorías de empleado" },
      { code: "catalogos.plazos-reembolso.gestionar", label: "Configurar plazo de reembolso" },
    ],
  },
  {
    key: "reportes",
    label: "Reportes",
    permissions: [
      { code: "reportes.ver", label: "Ver reportes" },
      { code: "reportes.exportar", label: "Exportar reportes" },
    ],
  },
  {
    key: "administracion",
    label: "Administración",
    permissions: [
      { code: "role:manage_permissions", label: "Gestionar roles y permisos" },
      { code: "admin.audit.ver", label: "Ver bitácora de auditoría" },
      { code: "admin.sistema.configurar", label: "Configurar sistema" },
    ],
  },
];

export const ALL_PERMISSION_CODES: string[] = PERMISSIONS_CATALOG.flatMap((m) =>
  m.permissions.map((p) => p.code)
);

export const ADMIN_PERMISSION_CODE = "role:manage_permissions";
