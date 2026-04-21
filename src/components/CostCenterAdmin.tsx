/**
 * CostCenterAdmin — CRUD view for hierarchical cost centers.
 * Reusable component planned for reuse in M3 dashboards.
 *
 * Currently operates on client-side state; API integration wired through
 * the `apiEndpoint` prop once M3-005 (cost-centers API) is delivered.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@components/Button";
import Modal from "@components/Modal";
import Toast from "@components/Toast";
import {
  buildCostCenterTree,
  flattenCostCenterTree,
  getDescendantIds,
} from "@type/CostCenter";
import type {
  CostCenter,
  CostCenterFormErrors,
  CostCenterFormValues,
  CostCenterNode,
} from "@type/CostCenter";
import { apiRequest } from "@utils/apiClient";

interface CostCenterAdminProps {
  initialData?: CostCenter[];
  apiEndpoint?: string;
  token?: string;
}

type DialogMode =
  | { kind: "closed" }
  | { kind: "create"; parentId: number | null }
  | { kind: "edit"; cc: CostCenter }
  | { kind: "delete"; cc: CostCenter };

const SEED_DATA: CostCenter[] = [
  { cost_center_id: 1, code: "CC-100", name: "Corporativo", parent_id: null },
  { cost_center_id: 2, code: "CC-110", name: "Finanzas", parent_id: 1 },
  { cost_center_id: 3, code: "CC-111", name: "Tesorería", parent_id: 2 },
  { cost_center_id: 4, code: "CC-120", name: "Recursos Humanos", parent_id: 1 },
  { cost_center_id: 5, code: "CC-200", name: "Operaciones", parent_id: null },
  { cost_center_id: 6, code: "CC-210", name: "Logística", parent_id: 5 },
];

const emptyForm: CostCenterFormValues = { code: "", name: "", parent_id: null };

export default function CostCenterAdmin({
  initialData,
  apiEndpoint,
  token,
}: CostCenterAdminProps) {
  const [items, setItems] = useState<CostCenter[]>(initialData ?? SEED_DATA);
  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });
  const [form, setForm] = useState<CostCenterFormValues>(emptyForm);
  const [errors, setErrors] = useState<CostCenterFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<
    { message: string; type: "success" | "error" } | null
  >(null);

  useEffect(() => {
    if (!apiEndpoint) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<CostCenter[]>(apiEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!cancelled && Array.isArray(data)) setItems(data);
      } catch (err) {
        console.warn("[CostCenterAdmin] fetch failed, using seed data", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiEndpoint, token]);

  const tree = useMemo(() => buildCostCenterTree(items), [items]);
  const flat = useMemo(() => flattenCostCenterTree(tree), [tree]);

  const parentOptions = useMemo<CostCenterNode[]>(() => {
    if (dialog.kind !== "edit") return flat;
    const forbidden = getDescendantIds(tree, dialog.cc.cost_center_id);
    return flat.filter((n) => !forbidden.has(n.cost_center_id));
  }, [flat, tree, dialog]);

  const openCreate = (parentId: number | null = null) => {
    setForm({ ...emptyForm, parent_id: parentId });
    setErrors({});
    setDialog({ kind: "create", parentId });
  };

  const openEdit = (cc: CostCenter) => {
    setForm({ code: cc.code, name: cc.name, parent_id: cc.parent_id });
    setErrors({});
    setDialog({ kind: "edit", cc });
  };

  const closeDialog = () => {
    setDialog({ kind: "closed" });
    setErrors({});
    setSubmitting(false);
  };

  const validate = useCallback(
    (values: CostCenterFormValues, editingId?: number): CostCenterFormErrors => {
      const next: CostCenterFormErrors = {};
      const code = values.code.trim();
      const name = values.name.trim();

      if (!code) next.code = "El código es requerido";
      else if (!/^[A-Za-z0-9_-]{2,20}$/.test(code))
        next.code = "2–20 caracteres: letras, números, guion o guion bajo";
      else if (
        items.some(
          (i) =>
            i.code.toLowerCase() === code.toLowerCase() &&
            i.cost_center_id !== editingId
        )
      )
        next.code = "Este código ya existe";

      if (!name) next.name = "El nombre es requerido";
      else if (name.length > 80) next.name = "Máximo 80 caracteres";

      if (values.parent_id != null && values.parent_id === editingId)
        next.parent_id = "Un centro no puede ser su propio padre";

      return next;
    },
    [items]
  );

  const handleSubmit = async () => {
    const editingId =
      dialog.kind === "edit" ? dialog.cc.cost_center_id : undefined;
    const nextErrors = validate(form, editingId);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (dialog.kind === "create") {
        const payload = {
          code: form.code.trim(),
          name: form.name.trim(),
          parent_id: form.parent_id,
        };
        let created: CostCenter | null = null;
        if (apiEndpoint) {
          try {
            created = await apiRequest<CostCenter>(apiEndpoint, {
              method: "POST",
              data: payload,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
          } catch (err) {
            console.warn("[CostCenterAdmin] create failed, using local state", err);
          }
        }
        const nextId =
          created?.cost_center_id ??
          (items.reduce((m, i) => Math.max(m, i.cost_center_id), 0) + 1);
        setItems((prev) => [
          ...prev,
          created ?? { cost_center_id: nextId, ...payload },
        ]);
        setToast({ message: "Centro de costos creado", type: "success" });
      } else if (dialog.kind === "edit") {
        const payload = {
          code: form.code.trim(),
          name: form.name.trim(),
          parent_id: form.parent_id,
        };
        if (apiEndpoint) {
          try {
            await apiRequest(`${apiEndpoint}/${dialog.cc.cost_center_id}`, {
              method: "PUT",
              data: payload,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
          } catch (err) {
            console.warn("[CostCenterAdmin] update failed, using local state", err);
          }
        }
        setItems((prev) =>
          prev.map((i) =>
            i.cost_center_id === dialog.cc.cost_center_id ? { ...i, ...payload } : i
          )
        );
        setToast({ message: "Centro de costos actualizado", type: "success" });
      }
      closeDialog();
    } catch (err) {
      console.error(err);
      setToast({ message: "Error al guardar los cambios", type: "error" });
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (dialog.kind !== "delete") return;
    setSubmitting(true);
    const id = dialog.cc.cost_center_id;
    const descendants = getDescendantIds(tree, id);
    if (apiEndpoint) {
      try {
        await apiRequest(`${apiEndpoint}/${id}`, {
          method: "PUT",
          data: { active: false },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      } catch (err) {
        console.warn("[CostCenterAdmin] delete failed, using local state", err);
      }
    }
    setItems((prev) => prev.filter((i) => !descendants.has(i.cost_center_id)));
    setToast({ message: "Centro de costos eliminado", type: "success" });
    closeDialog();
  };

  const dialogOpen = dialog.kind !== "closed";
  const isFormDialog = dialog.kind === "create" || dialog.kind === "edit";
  const dialogTitle =
    dialog.kind === "create"
      ? "Nuevo centro de costos"
      : dialog.kind === "edit"
      ? "Editar centro de costos"
      : dialog.kind === "delete"
      ? "Eliminar centro de costos"
      : "";
  const dialogMessage =
    dialog.kind === "delete"
      ? `¿Confirmas eliminar "${dialog.cc.code} · ${dialog.cc.name}"? Los centros hijos también serán eliminados.`
      : "";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {flat.length} {flat.length === 1 ? "centro" : "centros"} registrados ·
          {" "}
          {tree.length} {tree.length === 1 ? "raíz" : "raíces"}
        </p>
        <Button
          type="button"
          variant="filled"
          color="primary"
          onClick={() => openCreate(null)}
        >
          + Nuevo centro
        </Button>
      </div>

      <section className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                <th className="px-6 py-3 text-left eyebrow">Código</th>
                <th className="px-6 py-3 text-left eyebrow">Nombre</th>
                <th className="px-6 py-3 text-left eyebrow hidden md:table-cell">
                  Padre
                </th>
                <th className="px-6 py-3 text-right eyebrow">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {flat.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-sm text-[var(--color-ink-muted)]"
                  >
                    No hay centros de costos registrados.
                  </td>
                </tr>
              ) : (
                flat.map((node, idx) => {
                  const parent = items.find(
                    (i) => i.cost_center_id === node.parent_id
                  );
                  const isLast = idx === flat.length - 1;
                  return (
                    <tr
                      key={node.cost_center_id}
                      className={`${
                        !isLast
                          ? "border-b border-[var(--color-neutral-200)]"
                          : ""
                      } hover:bg-[var(--color-surface-secondary)] transition-colors`}
                    >
                      <td
                        className="px-6 py-4 text-sm tabular-nums text-[var(--color-ink)]"
                        style={{ paddingLeft: `${1.5 + node.depth * 1.25}rem` }}
                      >
                        <span className="inline-flex items-center gap-2">
                          {node.depth > 0 && (
                            <span
                              aria-hidden="true"
                              className="text-[var(--color-ink-subtle)]"
                            >
                              └
                            </span>
                          )}
                          <span className="font-medium">{node.code}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink)]">
                        {node.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink-muted)] hidden md:table-cell">
                        {parent ? `${parent.code} · ${parent.name}` : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openCreate(node.cost_center_id)}
                            className="text-sm text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] transition-colors font-medium cursor-pointer"
                          >
                            + Hijo
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(node)}
                            className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "delete", cc: node })
                            }
                            className="text-sm text-accent-400 hover:text-accent-300 transition-colors font-medium cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        show={dialogOpen}
        title={dialogTitle}
        message={dialogMessage}
        type={dialog.kind === "delete" ? "warning" : "confirm"}
        onClose={closeDialog}
        onConfirm={isFormDialog ? handleSubmit : handleDelete}
        confirmLabel={
          submitting
            ? "Guardando..."
            : dialog.kind === "delete"
            ? "Eliminar"
            : dialog.kind === "edit"
            ? "Actualizar"
            : "Crear"
        }
        cancelLabel="Cancelar"
      >
        {isFormDialog && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Código <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.code
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
                placeholder="CC-100"
                autoFocus
              />
              {errors.code && (
                <p className="text-accent-400 text-xs mt-1">{errors.code}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Nombre <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.name
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
                placeholder="Tesorería Corporativa"
              />
              {errors.name && (
                <p className="text-accent-400 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Centro padre{" "}
                <span className="text-[var(--color-ink-muted)]">(opcional)</span>
              </label>
              <select
                value={form.parent_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    parent_id: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.parent_id
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
              >
                <option value="">— Sin padre (nivel raíz) —</option>
                {parentOptions.map((n) => (
                  <option key={n.cost_center_id} value={n.cost_center_id}>
                    {"— ".repeat(n.depth)}
                    {n.code} · {n.name}
                  </option>
                ))}
              </select>
              {errors.parent_id && (
                <p className="text-accent-400 text-xs mt-1">{errors.parent_id}</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <Toast
          key={toast.message + toast.type + Date.now()}
          message={toast.message}
          type={toast.type}
          duration={toast.type === "success" ? 3000 : 5000}
        />
      )}
    </div>
  );
}
