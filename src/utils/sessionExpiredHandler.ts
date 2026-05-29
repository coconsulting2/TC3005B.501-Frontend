/**
 * Centralized handler for expired/invalid session tokens.
 * Detects session-related 401 error codes from the backend, clears local state,
 * shows a warning dialog, and redirects to /login after user acknowledgement.
 * A module-level guard prevents multiple concurrent 401s from stacking dialogs.
 */

import { showAppAlertAsync } from "@utils/appAlert";
import { clearSessionCookies } from "@data/cookies";
import { clearPermissionCache } from "@stores/permissionStore";
import { clearOrgStore } from "@stores/organizationStore";

const SESSION_ERROR_CODES = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN", "MISSING_TOKEN"]);

let isHandlingExpiration = false;

export function isSessionError(responseBody: unknown): boolean {
  if (responseBody && typeof responseBody === "object" && "error" in responseBody) {
    return SESSION_ERROR_CODES.has((responseBody as { error: string }).error);
  }
  return false;
}

export function handleSessionExpired(): void {
  if (typeof window === "undefined") return;
  if (isHandlingExpiration) return;
  isHandlingExpiration = true;

  clearSessionCookies();
  clearPermissionCache();
  clearOrgStore();

  showAppAlertAsync(
    "Tu sesion ha expirado. Por favor inicia sesion nuevamente.",
    { title: "Sesion expirada", variant: "warning" },
  ).then(() => {
    window.location.href = "/login";
  });
}
