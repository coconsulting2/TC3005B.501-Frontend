/**
 * ApiKeysManager — generar, nombrar y revocar llaves API para integraciones ERP.
 * Requiere permiso `api_key:manage`. El secreto solo se muestra una vez al crear.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import { getCachedPermissions } from "@stores/permissionStore";
import { hasPermission } from "@utils/permissions";
import { getImpersonatedOrgId } from "@stores/organizationStore";
import type { Organization, OrganizationListResponse } from "@type/organization";
import type {
  ApiKeyGenerateResponse,
  ApiKeyLogEntry,
  ApiKeyRecord,
} from "@type/apiKey";
import Toast from "@components/Toast";

const T = {
  ink: "var(--color-ink)",
  inkSecondary: "var(--color-ink-secondary)",
  surface: "var(--color-surface-white)",
  border: "var(--color-neutral-300)",
  borderSoft: "var(--color-neutral-200)",
  primary: "var(--color-primary-500)",
  success: "var(--color-success-500)",
  error: "var(--color-error-500)",
  warning: "var(--color-warning-500)",
  scrim: "rgba(10, 10, 10, 0.42)",
} as const;

const DEFAULT_PERMISSIONS = ["accounting:export"] as const;

function defaultExpiresAt(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  const detail =
    err && typeof err === "object" && "detail" in err
      ? (err as { detail?: { response?: { error?: string } } }).detail
      : undefined;
  if (detail?.response && typeof detail.response.error === "string") {
    return detail.response.error;
  }
  return err instanceof Error ? err.message : fallback;
}

interface Props {
  token?: string;
}

export default function ApiKeysManager(_props: Props) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [orgId, setOrgId] = useState<string>("");
  const [orgLabel, setOrgLabel] = useState<string>("");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [canPickOrg, setCanPickOrg] = useState(false);

  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt);
  const [generating, setGenerating] = useState(false);

  const [revealedSecret, setRevealedSecret] = useState<ApiKeyGenerateResponse | null>(null);
  const [expandedLogsId, setExpandedLogsId] = useState<number | null>(null);
  const [logsByKey, setLogsByKey] = useState<Record<number, ApiKeyLogEntry[]>>({});
  const [logsLoading, setLogsLoading] = useState<number | null>(null);

  const activeOrgId = useMemo(() => {
    const impersonated = getImpersonatedOrgId();
    return impersonated || orgId;
  }, [orgId]);

  const loadKeys = useCallback(async (targetOrgId: string) => {
    if (!targetOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await apiRequest<ApiKeyRecord[]>(`/keys/org/${targetOrgId}`);
      setKeys(
        rows.map((r) => ({
          ...r,
          organizationId: (r as ApiKeyRecord & { org_id?: string }).organizationId
            ?? (r as { org_id?: string }).org_id
            ?? targetOrgId,
          expiresAt: (r as ApiKeyRecord & { expires_at?: string }).expiresAt
            ?? (r as { expires_at?: string }).expires_at
            ?? "",
          revokedAt: (r as ApiKeyRecord & { revoked_at?: string | null }).revokedAt
            ?? (r as { revoked_at?: string | null }).revoked_at
            ?? null,
          createdAt: (r as ApiKeyRecord & { created_at?: string }).createdAt
            ?? (r as { created_at?: string }).created_at
            ?? "",
        })),
      );
    } catch (e) {
      setError(getApiErrorMessage(e, "No se pudieron cargar las llaves API."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const perms = await getCachedPermissions();
        const ok = hasPermission(perms, "api_key:manage");
        setAllowed(ok);
        if (!ok) {
          setLoading(false);
          return;
        }

        const canListAll = hasPermission(perms, "organization:list_all");
        setCanPickOrg(canListAll);

        if (canListAll) {
          const res = await apiRequest<OrganizationListResponse>("/organizations?pageSize=100");
          setOrgs(res.data);
          const impersonated = getImpersonatedOrgId();
          if (impersonated) {
            setOrgId(impersonated);
            const found = res.data.find((o) => o.id === impersonated);
            setOrgLabel(found?.nombre ?? impersonated);
          } else if (res.data.length > 0) {
            setOrgId(res.data[0].id);
            setOrgLabel(res.data[0].nombre);
          }
        } else {
          const me = await apiRequest<Organization>("/organizations/me");
          setOrgId(me.id);
          setOrgLabel(me.nombre);
        }
      } catch (e) {
        setAllowed(false);
        setError(getApiErrorMessage(e, "Error al inicializar la pantalla."));
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (allowed && activeOrgId) {
      void loadKeys(activeOrgId);
    }
  }, [allowed, activeOrgId, loadKeys]);

  const handleOrgChange = (nextId: string) => {
    setOrgId(nextId);
    const found = orgs.find((o) => o.id === nextId);
    setOrgLabel(found?.nombre ?? nextId);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !name.trim()) return;
    setGenerating(true);
    setToast(null);
    try {
      const res = await apiRequest<ApiKeyGenerateResponse>("/keys/generate", {
        method: "POST",
        data: {
          org_id: activeOrgId,
          name: name.trim(),
          expires_at: new Date(`${expiresAt}T23:59:59.999Z`).toISOString(),
          scope: { permissions: [...DEFAULT_PERMISSIONS] },
        },
      });
      setRevealedSecret(res);
      setName("");
      setExpiresAt(defaultExpiresAt());
      setToast({ message: "Llave creada. Copia el secreto ahora; no volverá a mostrarse.", type: "success" });
      void loadKeys(activeOrgId);
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, "Error al generar la llave."), type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: number, keyName: string) => {
    if (!confirm(`¿Revocar la llave "${keyName}"? Los ERP que la usen dejarán de funcionar.`)) return;
    try {
      await apiRequest(`/keys/${id}/revoke`, { method: "DELETE" });
      setToast({ message: "Llave revocada.", type: "success" });
      void loadKeys(activeOrgId);
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, "Error al revocar."), type: "error" });
    }
  };

  const toggleLogs = async (keyId: number) => {
    if (expandedLogsId === keyId) {
      setExpandedLogsId(null);
      return;
    }
    setExpandedLogsId(keyId);
    if (logsByKey[keyId]) return;
    setLogsLoading(keyId);
    try {
      const rows = await apiRequest<ApiKeyLogEntry[]>(`/keys/${keyId}/logs?limit=50`);
      setLogsByKey((prev) => ({ ...prev, [keyId]: rows }));
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, "Error al cargar logs."), type: "error" });
    } finally {
      setLogsLoading(null);
    }
  };

  const copySecret = async () => {
    if (!revealedSecret?.key) return;
    try {
      await navigator.clipboard.writeText(revealedSecret.key);
      setToast({ message: "Secreto copiado al portapapeles.", type: "success" });
    } catch {
      setToast({ message: "No se pudo copiar; selecciona el texto manualmente.", type: "error" });
    }
  };

  if (allowed === null) {
    return <p style={{ color: T.inkSecondary }}>Cargando permisos…</p>;
  }

  if (!allowed) {
    return (
      <div className="card-editorial p-4" style={{ borderColor: T.error, color: T.error }}>
        No tienes permiso para administrar llaves API (`api_key:manage`).
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {canPickOrg && orgs.length > 0 ? (
        <label className="block text-sm max-w-md">
          <span style={{ color: T.inkSecondary }}>Organización</span>
          <select
            className="mt-1 w-full border rounded px-3 py-2"
            value={orgId}
            onChange={(e) => handleOrgChange(e.target.value)}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} ({o.status})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm" style={{ color: T.inkSecondary }}>
          Organización: <strong style={{ color: T.ink }}>{orgLabel || activeOrgId}</strong>
        </p>
      )}

      <section
        className="rounded-lg border p-5 space-y-4"
        style={{ background: T.surface, borderColor: T.borderSoft }}
      >
        <h2 className="text-lg font-semibold" style={{ color: T.ink }}>
          Nueva llave API
        </h2>
        <p className="text-sm" style={{ color: T.inkSecondary }}>
          Las integraciones ERP envían la llave en la cabecera{" "}
          <code>X-API-Key</code> para consumir exportación contable sin usuario humano.
        </p>
        <form onSubmit={handleGenerate} className="grid gap-4 max-w-lg">
          <label className="text-sm block">
            <span style={{ color: T.inkSecondary }}>Nombre descriptivo</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ERP SAP Producción"
              maxLength={120}
              required
            />
          </label>
          <label className="text-sm block">
            <span style={{ color: T.inkSecondary }}>Expira el</span>
            <input
              type="date"
              className="mt-1 w-full border rounded px-3 py-2"
              value={expiresAt}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          </label>
          <p className="text-xs" style={{ color: T.inkSecondary }}>
            Permisos: <code>accounting:export</code> (exportación contable).
          </p>
          <button
            type="submit"
            disabled={generating || !name.trim()}
            className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-50"
            style={{ background: T.primary }}
          >
            {generating ? "Generando…" : "Generar llave"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: T.ink }}>
          Llaves registradas
        </h2>
        {error && (
          <p className="text-sm" style={{ color: T.error }}>
            {error}
          </p>
        )}
        {loading ? (
          <p style={{ color: T.inkSecondary }}>Cargando llaves…</p>
        ) : keys.length === 0 ? (
          <p style={{ color: T.inkSecondary }}>No hay llaves para esta organización.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: T.borderSoft }}>
            <table className="w-full text-sm">
              <thead style={{ background: "var(--color-surface-tertiary)" }}>
                <tr>
                  <th className="text-left p-3">Nombre</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-left p-3">Expira</th>
                  <th className="text-left p-3">Creada</th>
                  <th className="text-right p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <Fragment key={k.id}>
                    <tr className="border-t" style={{ borderColor: T.borderSoft }}>
                      <td className="p-3 font-medium">{k.name}</td>
                      <td className="p-3">
                        {k.active ? (
                          <span style={{ color: T.success }}>Activa</span>
                        ) : k.revokedAt ? (
                          <span style={{ color: T.error }}>Revocada</span>
                        ) : (
                          <span style={{ color: T.warning }}>Expirada</span>
                        )}
                      </td>
                      <td className="p-3">{formatDate(k.expiresAt)}</td>
                      <td className="p-3">{formatDate(k.createdAt)}</td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          type="button"
                          className="text-sm underline"
                          style={{ color: T.primary }}
                          onClick={() => void toggleLogs(k.id)}
                        >
                          {expandedLogsId === k.id ? "Ocultar logs" : "Ver logs"}
                        </button>
                        {k.active && (
                          <button
                            type="button"
                            className="text-sm underline"
                            style={{ color: T.error }}
                            onClick={() => void handleRevoke(k.id, k.name)}
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedLogsId === k.id && (
                      <tr key={`${k.id}-logs`}>
                        <td colSpan={5} className="p-3 bg-[var(--color-surface-secondary)]">
                          {logsLoading === k.id ? (
                            <p>Cargando consumos…</p>
                          ) : (logsByKey[k.id]?.length ?? 0) === 0 ? (
                            <p style={{ color: T.inkSecondary }}>Sin consumos registrados.</p>
                          ) : (
                            <ul className="space-y-1 font-mono text-xs">
                              {logsByKey[k.id].map((log) => (
                                <li key={String(log.id)}>
                                  {formatDate(log.timestamp)} — {log.endpoint} → HTTP {log.responseCode}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {revealedSecret && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: T.scrim }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-key-secret-title"
        >
          <div
            className="max-w-lg w-full rounded-lg border p-6 space-y-4 shadow-xl"
            style={{ background: T.surface, borderColor: T.border }}
          >
            <h3 id="api-key-secret-title" className="text-lg font-semibold" style={{ color: T.ink }}>
              Guarda esta llave ahora
            </h3>
            <p className="text-sm" style={{ color: T.inkSecondary }}>
              <strong>{revealedSecret.name}</strong> — el secreto no se volverá a mostrar.
            </p>
            <pre
              className="p-3 rounded text-xs overflow-x-auto break-all"
              style={{ background: "var(--color-surface-secondary)" }}
            >
              {revealedSecret.key}
            </pre>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded text-white text-sm"
                style={{ background: T.primary }}
                onClick={() => void copySecret()}
              >
                Copiar secreto
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded border text-sm"
                onClick={() => setRevealedSecret(null)}
              >
                Ya la guardé
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
