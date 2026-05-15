/**
 * @file utils/uploadOnboarding.ts
 * @description Helper para subir archivos de onboarding (multipart/form-data).
 *
 * No usa apiRequest porque este envía application/json. Este helper envía
 * FormData con el archivo y maneja CSRF + sesión de la misma forma.
 */
import { getSession } from "@data/cookies";
import { getImpersonatedOrgId } from "@stores/organizationStore";
import type {
  PreviewImportResponse,
  ApplyImportResponse,
  CustomImportRoleSpec,
} from "@type/onboardingImport";

const DEFAULT_API = "https://localhost:3000/api";

export type ApplyImportOptions = {
  roleMappings?: Record<string, string>;
  /**
   * userName → rol elegido en la UI; tiene prioridad sobre el rol del archivo
   * y los `roleMappings`. Permite cambiar el rol "al vuelo" antes de aplicar.
   */
  roleOverrides?: Record<string, string>;
  permissionExtras?: Record<string, string[]>;
  /** userName → rol creado en BD al aplicar: clona tope del rol base y permisos exactos. */
  customImportRoles?: Record<string, CustomImportRoleSpec>;
  /** Misma contraseña para todos los usuarios del lote (opcional). */
  passwordGlobal?: string;
  /** userName → contraseña individual; tiene prioridad sobre global y archivo. */
  passwordOverrides?: Record<string, string>;
  /** Debe coincidir con la vista previa generada con `create_new_org=1`. */
  createNewOrganization?: boolean;
};

function resolveApiBase(): string {
  return (
    (typeof import.meta !== "undefined" && (import.meta.env?.PUBLIC_API_BASE_URL as string)) ||
    DEFAULT_API
  ).replace(/\/$/, "");
}

/**
 * Org destino para header `X-Organization-Id` (misma regla que `apiRequest`):
 * argumento explícito gana; si no, la org impersonada del layout (super-admin Ditta).
 */
function resolveImportTargetOrgId(explicitOrgId?: string): string | null {
  const trimmed = explicitOrgId?.trim();
  if (trimmed) return trimmed;
  if (typeof window !== "undefined") {
    return getImpersonatedOrgId();
  }
  return null;
}

async function getCsrfToken(): Promise<string> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/user/csrf-token`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo obtener CSRF token");
  const data = await res.json();
  return data.csrfToken as string;
}

/**
 * Envía el archivo al endpoint de preview y devuelve el resultado.
 *
 * @param file           - Objeto File del input/drag-drop.
 * @param orgId          - ID de la org destino (opcional). Si se omite, se usa la org
 *                         impersonada del selector principal (`getImpersonatedOrgId`), igual que el resto de la API.
 */
export async function uploadImportPreview(
  file: File,
  orgId?: string,
  opts?: { createNewOrganization?: boolean }
): Promise<PreviewImportResponse> {
  const base     = resolveApiBase();
  const session  = getSession();
  const csrf     = await getCsrfToken();

  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {
    "csrf-token": csrf,
  };
  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }
  const targetOrgId = opts?.createNewOrganization ? null : resolveImportTargetOrgId(orgId);
  if (targetOrgId) {
    headers["X-Organization-Id"] = targetOrgId;
  }

  const previewPath = `/onboarding/import/preview${
    opts?.createNewOrganization ? "?create_new_org=1" : ""
  }`;

  const res = await fetch(`${base}${previewPath}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `Error ${res.status}`);
  return json as PreviewImportResponse;
}

/**
 * Confirma la importación usando el previewToken obtenido en uploadImportPreview.
 *
 * @param orgId - Opcional; si se omite, misma resolución que `uploadImportPreview` (impersonación del layout).
 */
export async function applyImportPreview(
  previewToken: string,
  orgId?: string,
  opts?: ApplyImportOptions
): Promise<ApplyImportResponse> {
  const base    = resolveApiBase();
  const session = getSession();
  const csrf    = await getCsrfToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "csrf-token": csrf,
  };
  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }
  const targetOrgId = opts?.createNewOrganization ? null : resolveImportTargetOrgId(orgId);
  if (targetOrgId) {
    headers["X-Organization-Id"] = targetOrgId;
  }

  const body: Record<string, unknown> = { previewToken };
  if (opts?.roleMappings && Object.keys(opts.roleMappings).length > 0) {
    body.roleMappings = opts.roleMappings;
  }
  if (opts?.roleOverrides) {
    const filteredRoles: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts.roleOverrides)) {
      if (typeof v === "string" && v.trim()) filteredRoles[k] = v.trim();
    }
    if (Object.keys(filteredRoles).length > 0) body.roleOverrides = filteredRoles;
  }
  if (opts?.permissionExtras && Object.keys(opts.permissionExtras).length > 0) {
    body.permissionExtras = opts.permissionExtras;
  }
  if (opts?.passwordGlobal?.trim()) {
    body.passwordGlobal = opts.passwordGlobal.trim();
  }
  if (opts?.passwordOverrides) {
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts.passwordOverrides)) {
      if (v.trim()) filtered[k] = v.trim();
    }
    if (Object.keys(filtered).length > 0) body.passwordOverrides = filtered;
  }
  if (opts?.customImportRoles && Object.keys(opts.customImportRoles).length > 0) {
    body.customImportRoles = opts.customImportRoles;
  }

  const res = await fetch(`${base}/onboarding/import/apply`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `Error ${res.status}`);
  return json as ApplyImportResponse;
}

