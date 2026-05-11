/**
 * Multi-tenant store. Mantiene la org actual del JWT y el override de
 * impersonación de super-admin Ditta (X-Organization-Id).
 *
 * Persistencia: localStorage para que el impersonate sobreviva refresh.
 */
import type { Organization } from "@type/organization";

const STORAGE_KEY_ORG = "coco:currentOrg";
const STORAGE_KEY_IMPERSONATE = "coco:impersonatedOrgId";

let currentOrg: Organization | null = null;

const readWindow = <T>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeWindow = (key: string, value: unknown): void => {
  if (typeof window === "undefined") return;
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* ignore */
  }
};

export const setCurrentOrg = (org: Organization | null): void => {
  currentOrg = org;
  writeWindow(STORAGE_KEY_ORG, org);
};

export const getCurrentOrg = (): Organization | null => {
  if (currentOrg) return currentOrg;
  const fromStorage = readWindow<Organization>(STORAGE_KEY_ORG);
  if (fromStorage) currentOrg = fromStorage;
  return currentOrg;
};

export const clearOrgStore = (): void => {
  currentOrg = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY_ORG);
      window.localStorage.removeItem(STORAGE_KEY_IMPERSONATE);
    } catch { /* ignore */ }
  }
};

/**
 * Impersonation: solo el super-admin Ditta puede setear esto. El header
 * X-Organization-Id viaja en cada request automáticamente desde apiClient.
 */
export const setImpersonatedOrgId = (orgId: string | null): void => {
  writeWindow(STORAGE_KEY_IMPERSONATE, orgId);
};

export const getImpersonatedOrgId = (): string | null => {
  if (typeof window === "undefined") return null;
  return readWindow<string>(STORAGE_KEY_IMPERSONATE);
};

export const isImpersonating = (): boolean => getImpersonatedOrgId() !== null;
