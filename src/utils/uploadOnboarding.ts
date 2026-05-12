/**
 * @file utils/uploadOnboarding.ts
 * @description Helper para subir archivos de onboarding (multipart/form-data).
 *
 * No usa apiRequest porque este envía application/json. Este helper envía
 * FormData con el archivo y maneja CSRF + sesión de la misma forma.
 */
import { getSession } from "@data/cookies";
import type {
  PreviewImportResponse,
  ApplyImportResponse,
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
  /** Misma contraseña para todos los usuarios del lote (opcional). */
  passwordGlobal?: string;
  /** userName → contraseña individual; tiene prioridad sobre global y archivo. */
  passwordOverrides?: Record<string, string>;
};

function resolveApiBase(): string {
  return (
    (typeof import.meta !== "undefined" && (import.meta.env?.PUBLIC_API_BASE_URL as string)) ||
    DEFAULT_API
  ).replace(/\/$/, "");
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
 * @param orgId          - ID de la org destino (para impersonación Ditta).
 */
export async function uploadImportPreview(
  file: File,
  orgId?: string
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
  if (orgId) {
    headers["X-Organization-Id"] = orgId;
  }

  const res = await fetch(`${base}/onboarding/import/preview`, {
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
  if (orgId) {
    headers["X-Organization-Id"] = orgId;
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

