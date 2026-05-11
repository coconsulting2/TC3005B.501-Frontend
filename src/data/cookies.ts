// import type { UserRole } from "@type/roles";

// const mockCookies = {
//     username: "John Doe",
//     id: "1",
//     department_id: "1",
//     role: "Applicant" as UserRole //'Applicant' | 'Authorizer' | 'Admin' | 'AccountsPayable' | 'TravelAgency';
// };

// export const getCookie = (key: keyof typeof mockCookies): string | UserRole => {
//     return mockCookies[key];
// };

import type { APIContext } from "astro";
import type { UserRole } from "@type/roles";

export type Session = {
  username: string;
  id: string;
  role: UserRole;
  department_id?: string;
  token: string;
  permissions?: string[];
};

function emptySession(): Session {
  return {
    username: "",
    id: "",
    department_id: "",
    role: "" as UserRole,
    token: "",
  };
}

function resolveCookies(): APIContext["cookies"] | null {
  // En SSR sin Astro global el caller debe pasar cookies explícitamente.
  if (typeof globalThis.window !== "undefined") {
    return null;
  }
  const astro = (globalThis as any).Astro;
  if (astro && astro.cookies && typeof astro.cookies.get === "function") {
    return astro.cookies;
  }
  if (import.meta.env.DEV) {
    console.warn("[WARN] resolveCookies(): Astro.cookies no disponible en este contexto SSR.");
  }
  return null;
}

/**
 * Lee una cookie del documento (solo navegador). LoginForm escribe `token`, `role`, etc.
 * para que apiRequest y fetch desde islas React puedan enviar Authorization Bearer.
 */
function readCookieFromDocument(name: string): string {
  if (typeof document === "undefined") return "";
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : "";
}

function getSessionFromBrowser(): Session {
  return {
    username: readCookieFromDocument("username"),
    id: readCookieFromDocument("user_id") || readCookieFromDocument("id"),
    department_id: readCookieFromDocument("department_id"),
    role: readCookieFromDocument("role") as UserRole,
    token: readCookieFromDocument("token"),
  };
}

function getSessionFromAstro(realCookies: APIContext["cookies"]): Session {
  const username = realCookies.get("username")?.value || "";
  const id =
    realCookies.get("id")?.value ||
    realCookies.get("user_id")?.value ||
    "";
  const department_id = realCookies.get("department_id")?.value || "";
  const role = realCookies.get("role")?.value || "";
  const token = realCookies.get("token")?.value || "";

  return {
    username,
    id,
    department_id,
    role: role as UserRole,
    token,
  };
}

export function getSession(cookies?: APIContext["cookies"]): Session {
  if (cookies) {
    return getSessionFromAstro(cookies);
  }
  if (typeof globalThis.window !== "undefined") {
    return getSessionFromBrowser();
  }
  const astro = resolveCookies();
  if (astro) {
    return getSessionFromAstro(astro);
  }
  return emptySession();
}

type CookieKey = Exclude<keyof Session, "permissions">;

export function getCookie(key: CookieKey, cookies?: APIContext["cookies"]): string {
  return getSession(cookies)[key] ?? "";
}
