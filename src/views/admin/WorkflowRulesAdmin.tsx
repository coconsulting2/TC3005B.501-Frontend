/**
 * WorkflowRulesAdmin — CRUD panel for workflow rules per organization.
 * Visible only for the org Administrador role (workflow:manage permission).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import type { WorkflowRuleDTO, WfRuleType, WfParamType } from "@type/WorkflowRuleTypes";

/* ── Design Tokens ─────────────────────────────────────────────── */
const T = {
  ink: "var(--color-ink)",
  inkSecondary: "var(--color-ink-secondary)",
  inkMuted: "var(--color-ink-muted)",
  surface: "var(--color-surface-white)",
  surfaceMuted: "var(--color-surface-secondary)",
  surfaceTertiary: "var(--color-surface-tertiary)",
  border: "var(--color-neutral-300)",
  borderSoft: "var(--color-neutral-200)",
  rowAlt: "var(--color-surface-secondary)",
  headerBg: "var(--color-surface-tertiary)",
  primary: "var(--color-primary-500)",
  primarySoft: "var(--color-primary-100)",
  success: "var(--color-success-500)",
  successSoft: "var(--color-success-50)",
  error: "var(--color-error-500)",
  errorSoft: "var(--color-error-50)",
  warning: "var(--color-warning-500)",
  warningBg: "var(--color-warning-50)",
  scrim: "rgba(10, 10, 10, 0.42)",
} as const;

const RULE_TYPES: { value: WfRuleType; label: string }[] = [
  { value: "pre", label: "Pre-aprobación" },
  { value: "post", label: "Post-comprobación" },
];

const PARAM_TYPES: { value: WfParamType; label: string }[] = [
  { value: "importe", label: "Importe" },
  { value: "nivel", label: "Nivel org." },
  { value: "gasto", label: "Tipo de gasto" },
  { value: "destino", label: "Destino" },
  { value: "moneda", label: "Moneda" },
];

interface DepartmentOption {
  departmentId: number;
  departmentName: string;
  costsCenter?: string | null;
}

const EMPTY_FORM: Omit<WorkflowRuleDTO, "id" | "active" | "createdAt" | "departmentName" | "costsCenter"> = {
  ruleType: "pre",
  paramType: "importe",
  threshold: null,
  paramValue: null,
  approvalLevel: 1,
  skipIfBelow: null,
  priority: 10,
  departmentId: null,
  managerSteps: null,
  targetRole: null,
};

interface Props {
  token?: string;
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  const detail = err && typeof err === "object" && "detail" in err
    ? (err as { detail?: { response?: { error?: string } } }).detail
    : undefined;

  if (detail?.response && typeof detail.response.error === "string") {
    return detail.response.error;
  }

  return err instanceof Error ? err.message : fallback;
}

export default function WorkflowRulesAdmin({ token }: Props) {
  const [rules, setRules] = useState<WorkflowRuleDTO[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState<string>("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<WorkflowRuleDTO[]>("/workflow-rules", { headers });
      setRules(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Error al cargar reglas."));
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await apiRequest<DepartmentOption[]>("/workflow-rules/departments", { headers });
      setDepartments(data);
    } catch {
      /* Departments may not be available yet */
    }
  }, [headers]);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await apiRequest<string[]>("/workflow-rules/roles", { headers });
      setRoles(data);
    } catch {
      setRoles(["Solicitante", "N1", "N2", "Cuentas por pagar", "Administrador"]);
    }
  }, [headers]);

  useEffect(() => {
    fetchRules();
    fetchDepartments();
    fetchRoles();
  }, [fetchRules, fetchDepartments, fetchRoles]);

  const filteredRules = useMemo(() => {
    if (filterDept === "all") return rules;
    if (filterDept === "global") return rules.filter((r) => r.departmentId === null);
    return rules.filter((r) => String(r.departmentId) === filterDept);
  }, [rules, filterDept]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (rule: WorkflowRuleDTO) => {
    setEditingId(rule.id);
    setForm({
      ruleType: rule.ruleType,
      paramType: rule.paramType,
      threshold: rule.threshold,
      paramValue: rule.paramValue,
      approvalLevel: rule.approvalLevel,
      skipIfBelow: rule.skipIfBelow,
      priority: rule.priority,
      departmentId: rule.departmentId,
      managerSteps: rule.managerSteps,
      targetRole: rule.targetRole,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleToggle = async (rule: WorkflowRuleDTO) => {
    try {
      await apiRequest(`/workflow-rules/${rule.id}/toggle`, { method: "PATCH", headers });
      await fetchRules();
    } catch (err) {
      setError(getApiErrorMessage(err, "Error al cambiar estado."));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        threshold: form.paramType === "importe" && form.threshold != null ? Number(form.threshold) : null,
        paramValue: form.paramType !== "importe" ? form.paramValue : null,
        approvalLevel: Number(form.approvalLevel) || 1,
        skipIfBelow: form.skipIfBelow != null ? Number(form.skipIfBelow) : null,
        priority: Number(form.priority) || 10,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        managerSteps: form.managerSteps != null ? Number(form.managerSteps) : null,
        targetRole: form.targetRole || null,
      };

      if (editingId) {
        await apiRequest(`/workflow-rules/${editingId}`, { method: "PUT", data: payload, headers });
      } else {
        await apiRequest("/workflow-rules", { method: "POST", data: payload, headers });
      }
      setModalOpen(false);
      await fetchRules();
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Error al guardar."));
    } finally {
      setSaving(false);
    }
  };

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", fontFamily: "inherit" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 13, color: T.inkSecondary, fontWeight: 600 }}>Departamento:</label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
              fontSize: 13, background: T.surface, color: T.ink, minWidth: 200,
            }}
          >
            <option value="all">Todos</option>
            <option value="global">— Globales (sin depto.) —</option>
            {departments.map((d) => (
              <option key={d.departmentId} value={String(d.departmentId)}>
                {d.departmentName}{d.costsCenter ? ` (${d.costsCenter})` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={openCreate}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "none",
            background: T.primary, color: T.surface, fontWeight: 600, fontSize: 14,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
          Nueva regla
        </button>
      </div>

      {/* Status messages */}
      {error && (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, border: `1px solid ${T.error}`, background: T.errorSoft, color: T.error, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: T.inkMuted }}>Cargando reglas…</div>
      ) : filteredRules.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: T.inkMuted, background: T.surfaceMuted, borderRadius: 12, border: `1px dashed ${T.border}` }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, display: "block", marginBottom: 8 }}>rule_settings</span>
          No hay reglas de workflow configuradas{filterDept !== "all" ? " para este filtro" : ""}.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.headerBg }}>
                {["Tipo", "Parámetro", "Umbral", "Nivel", "Pasos jefe", "Rol destino", "Departamento", "Prioridad", "Estado", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: T.inkSecondary, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule, i) => (
                <tr
                  key={rule.id}
                  style={{ background: i % 2 === 0 ? T.surface : T.rowAlt, opacity: rule.active ? 1 : 0.5 }}
                >
                  <td style={td}>{rule.ruleType === "pre" ? "Pre" : "Post"}</td>
                  <td style={td}>{PARAM_TYPES.find((p) => p.value === rule.paramType)?.label ?? rule.paramType}</td>
                  <td style={{ ...td, fontFamily: "ui-monospace, monospace" }}>
                    {rule.paramType === "importe" && rule.threshold != null
                      ? `$${Number(rule.threshold).toLocaleString("es-MX")}`
                      : rule.paramValue ?? "—"}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>{rule.approvalLevel}</td>
                  <td style={{ ...td, textAlign: "center" }}>{rule.managerSteps ?? "—"}</td>
                  <td style={td}>{rule.targetRole ?? "—"}</td>
                  <td style={td}>
                    {rule.departmentName
                      ? `${rule.departmentName}${rule.costsCenter ? ` (${rule.costsCenter})` : ""}`
                      : <span style={{ color: T.inkMuted }}>Global</span>}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>{rule.priority}</td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => handleToggle(rule)}
                      title={rule.active ? "Desactivar" : "Activar"}
                      style={{
                        padding: "4px 12px", borderRadius: 12, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer",
                        background: rule.active ? T.successSoft : T.surfaceTertiary,
                        color: rule.active ? T.success : T.inkMuted,
                      }}
                    >
                      {rule.active ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => openEdit(rule)}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: T.primary, padding: 4 }}
                      title="Editar"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal crear/editar ── */}
      {modalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000, display: "flex",
            alignItems: "center", justifyContent: "center", background: T.scrim,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.surface, borderRadius: 16, width: "100%", maxWidth: 560,
              maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,.18)",
            }}
          >
            <header style={{ padding: "20px 24px 0", borderBottom: `1px solid ${T.borderSoft}`, paddingBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: T.ink }}>
                {editingId ? "Editar regla" : "Nueva regla de workflow"}
              </h3>
            </header>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {formError && (
                <div style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.error}`, background: T.errorSoft, color: T.error, fontSize: 13 }}>
                  {formError}
                </div>
              )}

              {/* Row 1: ruleType + paramType */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <FieldLabel label="Tipo de regla">
                  <select value={form.ruleType} onChange={(e) => updateForm("ruleType", e.target.value as WfRuleType)} style={selectStyle}>
                    {RULE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </FieldLabel>
                <FieldLabel label="Parámetro">
                  <select value={form.paramType} onChange={(e) => updateForm("paramType", e.target.value as WfParamType)} style={selectStyle}>
                    {PARAM_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </FieldLabel>
              </div>

              {/* Row 2: threshold / paramValue */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {form.paramType === "importe" ? (
                  <FieldLabel label="Umbral ($)">
                    <input
                      type="number" min={0} step={100}
                      value={form.threshold ?? ""}
                      onChange={(e) => updateForm("threshold", e.target.value ? Number(e.target.value) : null)}
                      style={inputStyle}
                      placeholder="ej. 50000"
                    />
                  </FieldLabel>
                ) : (
                  <FieldLabel label="Valor del parámetro">
                    <input
                      type="text"
                      value={form.paramValue ?? ""}
                      onChange={(e) => updateForm("paramValue", e.target.value || null)}
                      style={inputStyle}
                      placeholder="ej. USD, 1, etc."
                    />
                  </FieldLabel>
                )}
                <FieldLabel label="Nivel de aprobación">
                  <input
                    type="number" min={1} max={10}
                    value={form.approvalLevel}
                    onChange={(e) => updateForm("approvalLevel", Number(e.target.value) || 1)}
                    style={inputStyle}
                  />
                </FieldLabel>
              </div>

              {/* Row 3: managerSteps + targetRole */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <FieldLabel label="Pasos de jefe (managerSteps)" hint="Cuántos jefes arriba deben aprobar">
                  <input
                    type="number" min={0} max={10}
                    value={form.managerSteps ?? ""}
                    onChange={(e) => updateForm("managerSteps", e.target.value ? Number(e.target.value) : null)}
                    style={inputStyle}
                    placeholder="ej. 2"
                  />
                </FieldLabel>
                <FieldLabel label="Rol destino (paso fijo)" hint="ej. Cuentas por pagar">
                  <select
                    value={form.targetRole ?? ""}
                    onChange={(e) => updateForm("targetRole", e.target.value || null)}
                    style={selectStyle}
                  >
                    <option value="">— Ninguno —</option>
                    {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FieldLabel>
              </div>

              {/* Row 4: department + skipIfBelow + priority */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <FieldLabel label="Departamento">
                  <select
                    value={form.departmentId ?? ""}
                    onChange={(e) => updateForm("departmentId", e.target.value ? Number(e.target.value) : null)}
                    style={selectStyle}
                  >
                    <option value="">Global (todos)</option>
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {d.departmentName}{d.costsCenter ? ` (${d.costsCenter})` : ""}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="Skip si menor a ($)">
                  <input
                    type="number" min={0} step={100}
                    value={form.skipIfBelow ?? ""}
                    onChange={(e) => updateForm("skipIfBelow", e.target.value ? Number(e.target.value) : null)}
                    style={inputStyle}
                    placeholder="Opcional"
                  />
                </FieldLabel>
                <FieldLabel label="Prioridad">
                  <input
                    type="number" min={1}
                    value={form.priority}
                    onChange={(e) => updateForm("priority", Number(e.target.value) || 10)}
                    style={inputStyle}
                  />
                </FieldLabel>
              </div>
            </div>

            <footer style={{ padding: "16px 24px", borderTop: `1px solid ${T.borderSoft}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ padding: "10px 20px", fontSize: 14, fontWeight: 600, color: T.inkSecondary, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "10px 24px", fontSize: 14, fontWeight: 600, color: T.surface,
                  background: saving ? T.inkMuted : T.primary,
                  border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Guardando…" : editingId ? "Actualizar" : "Crear regla"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-ink-secondary)", marginBottom: 4 }}>
        {label}
      </span>
      {hint && <span style={{ display: "block", fontSize: 11, color: "var(--color-ink-muted)", marginBottom: 4 }}>{hint}</span>}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--color-neutral-300)",
  fontSize: 14, background: "var(--color-surface-white)",
  color: "var(--color-ink)",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "auto",
};

const td: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--color-neutral-300)",
  color: "var(--color-ink-secondary)",
};
