/*
 * Author: Eduardo Porto Morales
 
 --GET
    const requests = await apiRequest('/applicant/get-user-requests/1');

 --POST
    await apiRequest('/applicant/create-request', {
        method: 'POST',
        data: { payload }
    });

 --PUT
    await apiRequest('/applicant/update-request/1', {
        method: 'PUT',
        data: { payload }
    });

*/

import { getSession } from "@data/cookies";
import { getImpersonatedOrgId } from "@stores/organizationStore";
import { isSessionError, handleSessionExpired } from "@utils/sessionExpiredHandler";

const DEFAULT_API = "https://localhost:3000/api";

/**
 * URL base del API. En el navegador: PUBLIC_API_BASE_URL (localhost).
 * En SSR dentro de Docker: `API_URL_SSR` apunta al backend en el host (p. ej. host.docker.internal).
 */
export function resolveApiBaseUrl(): string {
  const isBrowser = typeof window !== "undefined";
  if (!isBrowser && typeof process !== "undefined" && process.env.API_URL_SSR) {
    return String(process.env.API_URL_SSR).replace(/\/$/, "");
  }
  return (import.meta.env.PUBLIC_API_BASE_URL || DEFAULT_API).replace(/\/$/, "");
}

let csrfTokenPromise: Promise<string> | null = null;

/**
 * Obtiene token CSRF (cookie `_csrf` + valor para header). Reutiliza una petición en curso.
 * Usa la misma base que `apiRequest` (`PUBLIC_API_BASE_URL` / default) para no desincronizar orígenes.
 */
async function getCsrfToken(): Promise<string> {
  if (!csrfTokenPromise) {
    const base = resolveApiBaseUrl();
    csrfTokenPromise = fetch(`${base}/user/csrf-token`, {
      method: "GET",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `CSRF fetch failed: ${res.status}`);
        }
        const data = await res.json();
        if (!data?.csrfToken) {
          throw new Error("CSRF response missing csrfToken");
        }
        return data.csrfToken as string;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }
  return csrfTokenPromise;
}

const isServer = typeof window === 'undefined';
// `astro dev` → DEV true; build + preview o SSR en Docker puede tener DEV false pero NODE_ENV=development.
const isDevelopment =
  import.meta.env.DEV ||
  import.meta.env.MODE === "development" ||
  (typeof process !== "undefined" && process.env.NODE_ENV === "development");

/**
 * En SSR + desarrollo, Bun no siempre respeta NODE_TLS_REJECT_UNAUTHORIZED para su fetch nativo.
 * Esta función usa node:https con rejectUnauthorized:false como fallback garantizado.
 */
async function fetchWithInsecureTls(url: string, init: RequestInit): Promise<Response> {
  try {
    const https = await import("node:https");
    const parsedUrl = new URL(url);
    const agent = new https.Agent({ rejectUnauthorized: false });

    const body = init.body as string | undefined;
    const rawHeaders = (init.headers ?? {}) as Record<string, string>;

    return new Promise<Response>((resolve, reject) => {
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: init.method || "GET",
          headers: rawHeaders,
          agent,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const responseBody = Buffer.concat(chunks);
            resolve(
              new Response(responseBody, {
                status: res.statusCode ?? 200,
                headers: res.headers as HeadersInit,
              })
            );
          });
        }
      );
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  } catch {
    // node:https not available — fall back to global fetch with env-var bypass
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return fetch(url, init);
  }
}

type HTTP = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HTTP;
  data?: any;
  headers?: Record<string, string>;
  cookies?: import("astro").APIContext["cookies"];
}

export async function apiRequest<T = any>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  const { method = 'GET', data, headers = {}, cookies } = options;

  let token = "";
  try {
    const session = getSession(cookies); 
    token = session.token;
  } catch (e) {
    console.warn("[WARN] No se pudo obtener sesión en apiRequest", e);
  }

  const needsCsrf =
    method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
  /** El backend excluye CSRF solo en POST /api/user/login. */
  const skipCsrfForThisCall =
    method === "POST" && (path === "/user/login" || path.endsWith("/user/login"));
  let csrfToken: string | undefined;
  if (needsCsrf && !skipCsrfForThisCall) {
    try {
      csrfToken = await getCsrfToken();
    } catch (e) {
      console.warn("[WARN] No se pudo obtener CSRF token", e);
    }
  }

  // Multi-tenant: super-admin Ditta puede impersonar otra org enviando X-Organization-Id.
  // El backend valida que el JWT tenga organization_kind=ROOT antes de respetar el header.
  const impersonatedOrgId = typeof window !== "undefined" ? getImpersonatedOrgId() : null;

  const config: RequestInit = {
    method,
    credentials: "include",
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { "csrf-token": csrfToken } : {}),
      ...(impersonatedOrgId ? { "X-Organization-Id": impersonatedOrgId } : {}),
      ...headers,
    },
    ...(data && { body: JSON.stringify(data) }),
  };

  const fullUrl = `${baseUrl}${path}`;
  try {
    const res = isServer && isDevelopment
      ? await fetchWithInsecureTls(fullUrl, config)
      : await fetch(fullUrl, config);

    if (!res.ok) {
      const bodyText = await res.text();
      let response: unknown = bodyText;
      try {
        response = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        /* cuerpo no JSON */
      }
      if (res.status === 401 && isSessionError(response)) {
        handleSessionExpired();
      }

      throw {
        status: res.status,
        response,
      };
    }

    if (res.status === 204) {
      return undefined as T;
    }
    const text = await res.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    console.error("API request failed:", error);
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      "response" in error
    ) {
      throw {
        message: "Network or fetch error",
        detail: error as { status: number; response: unknown },
      };
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    throw {
      message: "Network or fetch error",
      detail: {
        response: {
          error: `${fullUrl} → ${errMsg}`,
        },
        raw: error,
      },
    };
  }
}
