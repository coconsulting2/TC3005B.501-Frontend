/**
 * Tipos para la importación masiva de usuarios en onboarding.
 * Corresponden a las respuestas de:
 *   POST /api/onboarding/import/preview
 *   POST /api/onboarding/import/apply
 */

export interface PermissionCatalogItem {
  code: string;
  action: string;
  description: string | null;
}

export interface PermissionCatalogGroup {
  resource: string;
  label: string;
  items: PermissionCatalogItem[];
}

export interface PermissionsCatalog {
  groups: PermissionCatalogGroup[];
}

export interface ImportUserPreview {
  userName: string;
  email: string;
  /** Rol ya resuelto en CocoConsulting (si existe). */
  roleName?: string;
  /** Etiqueta del archivo cuando no coincide con ningún rol (otra empresa). */
  externalRoleLabel?: string;
  needsRoleMapping?: boolean;
  /** Permisos que otorga el rol asignado (referencia). */
  rolePermissionCodes?: string[];
  /** @deprecated usar rolePermissionCodes */
  effectivePermissions?: string[];
  department?: string;
  firstName?: string;
  lastName?: string;
  /**
   * El archivo traía contraseña para este usuario (que descartamos).
   * Sirve para avisar al admin antes de aplicar.
   */
  hasFilePassword?: boolean;
}

/** Referencia: roles definidos en la org y sus permisos por rol. */
export interface RoleCatalogEntry {
  roleName: string;
  effectivePermissions: string[];
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportConflict {
  userName: string;
  email: string;
  reason: string;
}

export interface PreviewImportResponse {
  previewToken: string;
  strategy: "JSON" | "CSV";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  conflictRows: number;
  /** Filas que aún no tienen rol resuelto en esta org (etiqueta de otro sistema). */
  needsRoleMappingCount: number;
  /** Etiquetas distintas que debes mapear a un rol del catálogo antes de importar. */
  unmappedExternalRoles: string[];
  /** Si el JSON traía `roleMappings` en raíz (referencia / ayuda). */
  embeddedRoleMappingsFromFile?: Record<string, string>;
  /**
   * El archivo traía contraseñas. Por seguridad fueron descartadas: hay que
   * definir una contraseña global o por usuario antes de aplicar.
   */
  fileHadPasswords?: boolean;
  preview: ImportUserPreview[];
  /** Todos los usuarios válidos a importar (sin contraseña). La tabla solo muestra los primeros. */
  applyableUsernames?: string[];
  /** Catálogo global agrupado por recurso (para editar permisos adicionales). */
  permissionsCatalog?: PermissionsCatalog;
  rolesCatalog?: RoleCatalogEntry[];
  errors: ImportValidationError[];
  conflicts: ImportConflict[];
  /** Datos del bloque `organization` en JSON (si existen). */
  organizationFromFile?: {
    nombre: string;
    rfc?: string | null;
    razonSocial?: string | null;
    timezone?: string;
    baseCurrency?: string;
  };
  /** El usuario puede crear org nueva con este archivo (JSON + bloque org + permiso). */
  newOrganizationApplyAvailable?: boolean;
  /** Coincide con el query `create_new_org=1` usado en el preview; el apply debe enviar lo mismo. */
  previewCreateNewOrganization?: boolean;
}

export interface ApplyImportFailure {
  userName: string;
  reason: string;
}

export interface ApplyImportResponse {
  created: number;
  skipped: number;
  createdUsers: { userId: number; userName: string; email: string }[];
  appliedBy: number;
  /**
   * Filas que fallaron por colisión global UNIQUE (userName/email tomados por
   * otro usuario entre el preview y el apply).
   */
  failures?: ApplyImportFailure[];
  /** Presente cuando se creó una org CLIENT antes de importar usuarios. */
  createdOrganization?: { id: string; nombre: string };
}
