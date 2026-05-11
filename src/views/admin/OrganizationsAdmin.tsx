/**
 * OrganizationsAdmin — vista de gestión de organizaciones para super-admin Ditta.
 *
 * Cubre:
 *   - Listado con filtros por kind/status.
 *   - Crear org nueva (wizard simple: datos fiscales + admin inicial).
 *   - Activar / Suspender una org existente.
 *   - Switch de impersonate (X-Organization-Id) para ver datos de la org como su admin.
 */
import { useEffect, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import {
  setImpersonatedOrgId,
  getImpersonatedOrgId,
} from "@stores/organizationStore";
import type {
  Organization,
  OrganizationListResponse,
  CreateOrganizationInput,
} from "@type/organization";

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

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3">
          <label className="text-sm">
            <span className="block text-gray-600">Tipo</span>
            <select
              className="border rounded px-2 py-1"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as any)}
            >
              <option value="">Todos</option>
              <option value="ROOT">ROOT (Ditta)</option>
              <option value="CLIENT">Cliente</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-600">Estado</span>
            <select
              className="border rounded px-2 py-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="">Todos</option>
              <option value="CONFIGURING">En configuración</option>
              <option value="ACTIVE">Activa</option>
              <option value="SUSPENDED">Suspendida</option>
            </select>
          </label>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Nueva organización
        </button>
      </header>

      {impersonatedId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm flex items-center justify-between">
          <span>
            Estás viendo datos como org <strong>{impersonatedId}</strong>. Las queries usarán X-Organization-Id.
          </span>
          <button
            onClick={() => {
              setImpersonatedOrgId(null);
              setImpersonatedId(null);
            }}
            className="text-yellow-900 underline"
          >
            Salir de impersonate
          </button>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3">{error}</div>}

      {loading ? (
        <div>Cargando…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">RFC</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{o.id}</td>
                  <td className="px-3 py-2">{o.nombre}</td>
                  <td className="px-3 py-2">{o.rfc ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={o.kind === "ROOT" ? "text-purple-700 font-semibold" : ""}>{o.kind}</span>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-2 space-x-2 text-sm">
                    {o.kind !== "ROOT" && (
                      <button
                        onClick={() => handleImpersonate(o.id)}
                        className="text-blue-600 hover:underline"
                      >
                        {impersonatedId === o.id ? "Salir" : "Ver como"}
                      </button>
                    )}
                    {o.status !== "ACTIVE" && o.kind !== "ROOT" && (
                      <button onClick={() => handleActivate(o.id)} className="text-green-600 hover:underline">
                        Activar
                      </button>
                    )}
                    {o.status === "ACTIVE" && o.kind !== "ROOT" && (
                      <button onClick={() => handleSuspend(o.id)} className="text-red-600 hover:underline">
                        Suspender
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-6">
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
  const map: Record<Organization["status"], string> = {
    CONFIGURING: "bg-gray-100 text-gray-800",
    ACTIVE: "bg-green-100 text-green-800",
    SUSPENDED: "bg-red-100 text-red-800",
  };
  const label = { CONFIGURING: "En configuración", ACTIVE: "Activa", SUSPENDED: "Suspendida" }[status];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${map[status]}`}>{label}</span>;
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
      // RFC vacío se manda como null para que el backend lo respete como opcional.
      const payload = { ...form, rfc: form.rfc?.trim() || null };
      await apiRequest("/organizations", { method: "POST", data: payload });
      onCreated();
    } catch (e: any) {
      setError(e?.detail?.response?.error || "Error al crear la organización.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl space-y-4">
        <h2 className="text-xl font-semibold">Nueva organización</h2>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3">{error}</div>}

        <fieldset className="space-y-2">
          <legend className="font-medium">Datos fiscales</legend>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Nombre comercial *"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Razón social"
            value={form.razonSocial ?? ""}
            onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
          />
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="RFC (opcional)"
            value={form.rfc ?? ""}
            onChange={(e) => setForm({ ...form, rfc: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="border rounded px-2 py-1"
              placeholder="Zona horaria"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Moneda base"
              value={form.baseCurrency}
              onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-medium">Administrador inicial</legend>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Nombre completo *"
            value={form.adminNombre}
            onChange={(e) => setForm({ ...form, adminNombre: e.target.value })}
          />
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Email *"
            type="email"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
          />
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Contraseña inicial *"
            type="password"
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
          />
          <p className="text-xs text-gray-500">
            El admin podrá cambiar su contraseña al primer ingreso.
          </p>
        </fieldset>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border" disabled={submitting}>
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.nombre || !form.adminEmail || !form.adminPassword}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {submitting ? "Creando…" : "Crear organización"}
          </button>
        </div>
      </div>
    </div>
  );
}
