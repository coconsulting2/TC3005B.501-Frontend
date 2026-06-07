/**
 * OrganizationsAdmin — vista de gestión de organizaciones para super-admin Ditta.
 *
 * Cubre:
 *   - Listado con filtros por kind/status.
 *   - Crear org nueva (wizard simple: datos fiscales + admin inicial).
 *   - Activar / Suspender una org existente.
 *   - Switch de impersonate (X-Organization-Id) para ver datos de la org como su admin.
 *   - Ver usuarios de una org directamente (impersona + navega al dashboard).
 */
import { useEffect, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import {
  setImpersonatedOrgId,
  getImpersonatedOrgId,
} from "@stores/organizationStore";
import { getCachedPermissions } from "@stores/permissionStore";
import { hasPermission } from "@utils/permissions";
import type {
  Organization,
  OrganizationListResponse,
  CreateOrganizationInput,
} from "@type/organization";

/** Tokens visuales alineados con global.css (mismo patrón que WorkflowRulesAdmin). */
const T = {
  ink: "var(--color-ink)",
  inkSecondary: "var(--color-ink-secondary)",
  inkMuted: "var(--color-ink-muted)",
  surface: "var(--color-surface-white)",
  surfaceMuted: "var(--color-surface-secondary)",
  headerBg: "var(--color-surface-tertiary)",
  border: "var(--color-neutral-300)",
  borderSoft: "var(--color-neutral-200)",
  rowAlt: "var(--color-surface-secondary)",
  primary: "var(--color-primary-500)",
  primaryHover: "var(--color-primary-600)",
  success: "var(--color-success-600)",
  successBg: "var(--color-success-50)",
  successBorder: "var(--color-success-200)",
  error: "var(--color-error-600)",
  errorBg: "var(--color-error-50)",
  errorBorder: "var(--color-error-200)",
  warning: "var(--color-warning-700)",
  warningBg: "var(--color-warning-50)",
  warningBorder: "var(--color-warning-200)",
} as const;

interface Props {
  token?: string;
}

export default function OrganizationsAdmin(_: Props) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"" | "ROOT" | "CLIENT">("");
  const [statusFilter, setStatusFilter] = useState<"" | "CONFIGURING" | "ACTIVE" | "SUSPENDED">("");
  const [showWizard, setShowWizard] = useState(false);
  const [impersonatedId, setImpersonatedId] = useState<string | null>(getImpersonatedOrgId());
  const [canCreateOrganization, setCanCreateOrganization] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const perms = await getCachedPermissions();
        setCanCreateOrganization(hasPermission(perms, "organization:create"));
      } catch {
        setCanCreateOrganization(false);
      }
    })();
  }, []);

  const loadOrgs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (kindFilter) params.set("kind", kindFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await apiRequest<OrganizationListResponse>(
        `/organizations${params.toString() ? `?${params.toString()}` : ""}`
      );
      setOrgs(res.data);
    } catch (e: any) {
      const status = e?.detail?.status ?? e?.status;
      if (status === 403) {
        setError("No tienes permiso para ver la lista de organizaciones. Solo super-admin Ditta puede.");
      } else {
        setError(e?.detail?.response?.error || "No se pudieron cargar las organizaciones.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindFilter, statusFilter]);

  const handleImpersonate = (orgId: string) => {
    if (impersonatedId === orgId) {
      setImpersonatedOrgId(null);
      setImpersonatedId(null);
    } else {
      setImpersonatedOrgId(orgId);
      setImpersonatedId(orgId);
    }
  };

  const handleViewUsers = (orgId: string) => {
    setImpersonatedOrgId(orgId);
    setImpersonatedId(orgId);
    window.location.href = "/dashboard";
  };

  const handleSuspend = async (orgId: string) => {
    if (!confirm("¿Suspender esta organización? Sus usuarios no podrán entrar.")) return;
    try {
      await apiRequest(`/organizations/${orgId}/suspend`, { method: "POST" });
      void loadOrgs();
    } catch (e: any) {
      alert(e?.detail?.response?.error || "Error al suspender.");
    }
  };

  const handleActivate = async (orgId: string) => {
    try {
      await apiRequest(`/organizations/${orgId}/activate`, { method: "POST" });
      void loadOrgs();
    } catch (e: any) {
      alert(e?.detail?.response?.error || "Error al activar.");
    }
  };

  const selectStyle: React.CSSProperties = {
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 13,
    color: T.ink,
    background: T.surface,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: T.inkSecondary,
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={labelStyle}>
            <span style={{ display: "block", marginBottom: 4 }}>Tipo</span>
            <select style={selectStyle} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}>
              <option value="">Todos</option>
              <option value="ROOT">ROOT (Ditta)</option>
              <option value="CLIENT">Cliente</option>
            </select>
          </label>
          <label style={labelStyle}>
            <span style={{ display: "block", marginBottom: 4 }}>Estado</span>
            <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="">Todos</option>
              <option value="CONFIGURING">En configuración</option>
              <option value="ACTIVE">Activa</option>
              <option value="SUSPENDED">Suspendida</option>
            </select>
          </label>
        </div>
        {canCreateOrganization ? (
          <button
            onClick={() => setShowWizard(true)}
            style={{
              background: T.primary,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Nueva organización
          </button>
        ) : null}
      </header>

      {impersonatedId && (
        <div
          style={{
            background: T.warningBg,
            border: `1px solid ${T.warningBorder}`,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            color: T.warning,
          }}
        >
          <span>
            Estás viendo datos como org <strong>{impersonatedId}</strong>. Las queries usarán X-Organization-Id.
          </span>
          <button
            onClick={() => { setImpersonatedOrgId(null); setImpersonatedId(null); }}
            style={{ background: "none", border: "none", color: T.warning, cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
          >
            Salir de impersonate
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            background: T.errorBg,
            border: `1px solid ${T.errorBorder}`,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: T.error,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: T.inkMuted, fontSize: 14 }}>Cargando…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.headerBg }}>
                {["ID", "Nombre", "RFC", "Tipo", "Estado", "Acciones"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: T.inkSecondary,
                      borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((o, i) => (
                <tr
                  key={o.id}
                  style={{ background: i % 2 === 0 ? T.surface : T.rowAlt }}
                >
                  <td style={{ padding: "8px 12px", borderBottom: `1px solid ${T.borderSoft}`, fontFamily: "monospace", fontSize: 11, color: T.inkMuted }}>{o.id}</td>
                  <td style={{ padding: "8px 12px", borderBottom: `1px solid ${T.borderSoft}`, color: T.ink, fontWeight: 500 }}>{o.nombre}</td>
                  <td style={{ padding: "8px 12px", borderBottom: `1px solid ${T.borderSoft}`, color: T.inkSecondary }}>{o.rfc ?? "—"}</td>
                  <td style={{ padding: "8px 12px", borderBottom: `1px solid ${T.borderSoft}` }}>
                    <span style={{ color: o.kind === "ROOT" ? "var(--color-primary-700)" : T.ink, fontWeight: o.kind === "ROOT" ? 600 : 400 }}>
                      {o.kind}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", borderBottom: `1px solid ${T.borderSoft}` }}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td style={{ padding: "8px 12px", borderBottom: `1px solid ${T.borderSoft}`, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {o.kind !== "ROOT" && (
                      <button
                        onClick={() => handleViewUsers(o.id)}
                        style={{ background: "none", border: "none", color: T.primary, cursor: "pointer", fontSize: 13, padding: 0, fontWeight: 500 }}
                      >
                        Ver usuarios
                      </button>
                    )}
                    {o.kind !== "ROOT" && (
                      <button
                        onClick={() => handleImpersonate(o.id)}
                        style={{ background: "none", border: "none", color: T.inkSecondary, cursor: "pointer", fontSize: 13, padding: 0 }}
                      >
                        {impersonatedId === o.id ? "Salir" : "Ver como"}
                      </button>
                    )}
                    {o.status !== "ACTIVE" && o.kind !== "ROOT" && (
                      <button
                        onClick={() => handleActivate(o.id)}
                        style={{ background: "none", border: "none", color: T.success, cursor: "pointer", fontSize: 13, padding: 0 }}
                      >
                        Activar
                      </button>
                    )}
                    {o.status === "ACTIVE" && o.kind !== "ROOT" && (
                      <button
                        onClick={() => handleSuspend(o.id)}
                        style={{ background: "none", border: "none", color: T.error, cursor: "pointer", fontSize: 13, padding: 0 }}
                      >
                        Suspender
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", color: T.inkMuted, padding: "32px 12px", fontSize: 13 }}
                  >
                    Sin organizaciones para los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showWizard && (
        <CreateOrganizationWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            void loadOrgs();
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Organization["status"] }) {
  const styles: Record<Organization["status"], React.CSSProperties> = {
    CONFIGURING: { background: "var(--color-surface-secondary)", color: "var(--color-ink-secondary)", border: "1px solid var(--color-neutral-300)" },
    ACTIVE:      { background: "var(--color-success-50)",        color: "var(--color-success-700)",   border: "1px solid var(--color-success-200)" },
    SUSPENDED:   { background: "var(--color-error-50)",          color: "var(--color-error-700)",     border: "1px solid var(--color-error-200)" },
  };
  const label = { CONFIGURING: "En configuración", ACTIVE: "Activa", SUSPENDED: "Suspendida" }[status];
  return (
    <span style={{ display: "inline-block", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600, ...styles[status] }}>
      {label}
    </span>
  );
}

function CreateOrganizationWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateOrganizationInput>({
    nombre: "",
    rfc: "",
    razonSocial: "",
    timezone: "America/Mexico_City",
    baseCurrency: "MXN",
    adminEmail: "",
    adminNombre: "",
    adminPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...form, rfc: form.rfc?.trim() || null };
      await apiRequest("/organizations", { method: "POST", data: payload });
      onCreated();
    } catch (e: any) {
      setError(e?.detail?.response?.error || "Error al crear la organización.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid var(--color-neutral-300)`,
    borderRadius: 6,
    padding: "7px 10px",
    fontSize: 14,
    color: "var(--color-ink)",
    background: "var(--color-surface-white)",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "var(--color-surface-white)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--color-ink)" }}>Nueva organización</h2>

        {error && (
          <div style={{ background: "var(--color-error-50)", border: "1px solid var(--color-error-200)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--color-error-700)" }}>
            {error}
          </div>
        )}

        <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <legend style={{ fontWeight: 600, fontSize: 14, color: "var(--color-ink)", marginBottom: 8 }}>Datos fiscales</legend>
          <input style={inputStyle} placeholder="Nombre comercial *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input style={inputStyle} placeholder="Razón social" value={form.razonSocial ?? ""} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} />
          <input style={inputStyle} placeholder="RFC (opcional)" value={form.rfc ?? ""} onChange={(e) => setForm({ ...form, rfc: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input style={inputStyle} placeholder="Zona horaria" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            <input style={inputStyle} placeholder="Moneda base" value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })} />
          </div>
        </fieldset>

        <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <legend style={{ fontWeight: 600, fontSize: 14, color: "var(--color-ink)", marginBottom: 8 }}>Administrador inicial</legend>
          <input style={inputStyle} placeholder="Nombre completo *" value={form.adminNombre} onChange={(e) => setForm({ ...form, adminNombre: e.target.value })} />
          <input style={inputStyle} placeholder="Email *" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
          <input style={inputStyle} placeholder="Contraseña inicial *" type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-ink-muted)" }}>El admin podrá cambiar su contraseña al primer ingreso.</p>
        </fieldset>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid var(--color-neutral-300)`, background: "var(--color-surface-white)", color: "var(--color-ink)", fontSize: 14, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.nombre || !form.adminEmail || !form.adminPassword}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: submitting || !form.nombre || !form.adminEmail || !form.adminPassword ? "var(--color-neutral-300)" : "var(--color-primary-500)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting || !form.nombre || !form.adminEmail || !form.adminPassword ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Creando…" : "Crear organización"}
          </button>
        </div>
      </div>
    </div>
  );
}
