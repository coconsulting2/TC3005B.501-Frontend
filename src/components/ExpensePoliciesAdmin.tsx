/**
 * ExpensePoliciesAdmin — CRUD de políticas de viáticos (M2-006 RF-42, RF-43, RF-46).
 * Patrón: tabla + Modal + RHF/Zod + apiClient.
 */
import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@components/Button";
import Modal from "@components/Modal";
import Toast from "@components/Toast";
import { apiRequest } from "@utils/apiClient";

const VALID_SCOPES = ["nacional", "internacional", "any"] as const;
const VALID_CAP_UNITS = ["per_night", "per_trip", "per_day", "per_event"] as const;

const policySchema = z.object({
  name: z.string().trim().min(1, "Requerido").max(120, "Máximo 120 caracteres"),
  categoryId: z.union([z.coerce.number().int().positive(), z.literal("")]).optional(),
  destinationScope: z.enum(VALID_SCOPES).default("any"),
  costsCenter: z.string().trim().max(20).optional().nullable(),
  dailyPerDiem: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  currency: z.string().length(3).default("MXN"),
  validFrom: z.string().min(1, "Requerido"),
  validTo: z.string().optional().nullable(),
  caps: z.array(
    z.object({
      receiptTypeId: z.coerce.number().int().positive(),
      capAmount: z.coerce.number().min(0),
      capUnit: z.enum(VALID_CAP_UNITS),
      currency: z.string().length(3).default("MXN"),
    }),
  ).default([]),
});

type PolicyFormData = z.infer<typeof policySchema>;

interface ExpenseCap {
  capId: number;
  receiptTypeId: number;
  capAmount: string | number;
  capUnit: string;
  currency: string;
}

interface Policy {
  policyId: number;
  name: string;
  categoryId: number | null;
  destinationScope: string;
  costsCenter: string | null;
  dailyPerDiem: string | number | null;
  currency: string;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  expenseCaps: ExpenseCap[];
}

interface Category {
  categoryId: number;
  name: string;
  code: string;
}

interface ReceiptType {
  receiptTypeId: number;
  receiptTypeName: string;
}

interface Props { token?: string }

const RECEIPT_TYPES_FALLBACK: ReceiptType[] = [
  { receiptTypeId: 1, receiptTypeName: "Hospedaje" },
  { receiptTypeId: 2, receiptTypeName: "Comida" },
  { receiptTypeId: 6, receiptTypeName: "Vuelo" },
];

/**
 * @param {Props} props
 */
export default function ExpensePoliciesAdmin(_props: Props) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [receiptTypes, setReceiptTypes] = useState<ReceiptType[]>(RECEIPT_TYPES_FALLBACK);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      name: "", destinationScope: "any", currency: "MXN",
      validFrom: "", validTo: "", caps: [], categoryId: "" as any,
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "caps" });

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [polRes, catRes] = await Promise.all([
        apiRequest<{ policies: Policy[] }>("/policies"),
        apiRequest<{ categories: Category[] }>("/employee-categories"),
      ]);
      setPolicies(polRes.policies || []);
      setCategories(catRes.categories || []);
    } catch (e) {
      console.error(e);
      setToast({ message: "Error al cargar políticas.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    form.reset({
      name: "", destinationScope: "any", currency: "MXN",
      validFrom: new Date().toISOString().slice(0, 10), validTo: "", caps: [], categoryId: "" as any,
    });
    setModalOpen(true);
  }

  function openEdit(p: Policy) {
    setEditing(p);
    form.reset({
      name: p.name,
      categoryId: (p.categoryId ?? "") as any,
      destinationScope: (p.destinationScope as any) || "any",
      costsCenter: p.costsCenter || "",
      dailyPerDiem: (p.dailyPerDiem == null ? "" : Number(p.dailyPerDiem)) as any,
      currency: p.currency || "MXN",
      validFrom: (p.validFrom || "").slice(0, 10),
      validTo: p.validTo ? p.validTo.slice(0, 10) : "",
      caps: (p.expenseCaps || []).map((c) => ({
        receiptTypeId: c.receiptTypeId,
        capAmount: Number(c.capAmount),
        capUnit: c.capUnit as any,
        currency: c.currency || "MXN",
      })),
    });
    setModalOpen(true);
  }

  async function onSubmit(values: PolicyFormData) {
    const payload = {
      ...values,
      categoryId: values.categoryId === "" ? null : values.categoryId,
      dailyPerDiem: values.dailyPerDiem === "" ? null : values.dailyPerDiem,
      validTo: values.validTo === "" ? null : values.validTo,
      costsCenter: values.costsCenter || null,
    };
    try {
      if (editing) {
        await apiRequest(`/policies/${editing.policyId}`, { method: "PUT", data: payload });
        setToast({ message: "Política actualizada.", type: "success" });
      } else {
        await apiRequest("/policies", { method: "POST", data: payload });
        setToast({ message: "Política creada.", type: "success" });
      }
      setModalOpen(false);
      void loadAll();
    } catch (e: any) {
      const msg = e?.detail?.response?.error || "Error al guardar la política.";
      setToast({ message: msg, type: "error" });
    }
  }

  async function onDelete(p: Policy) {
    if (!confirm(`¿Desactivar la política "${p.name}"?`)) return;
    try {
      await apiRequest(`/policies/${p.policyId}`, { method: "DELETE" });
      setToast({ message: "Política desactivada.", type: "success" });
      void loadAll();
    } catch (e: any) {
      setToast({ message: e?.detail?.response?.error || "Error al desactivar.", type: "error" });
    }
  }

  const sorted = useMemo(
    () => [...policies].sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()),
    [policies]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <p style={{ margin: 0 }}>{loading ? "Cargando…" : `${policies.length} políticas`}</p>
        <Button variant="filled" color="primary" onClick={openCreate}>+ Nueva política</Button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Nombre</th>
            <th style={th}>Categoría</th>
            <th style={th}>Destino</th>
            <th style={th}>Centro Costo</th>
            <th style={th}>Vigencia</th>
            <th style={th}>Caps</th>
            <th style={th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.policyId}>
              <td style={td}>{p.name}</td>
              <td style={td}>{categories.find((c) => c.categoryId === p.categoryId)?.name || "—"}</td>
              <td style={td}>{p.destinationScope}</td>
              <td style={td}>{p.costsCenter || "—"}</td>
              <td style={td}>
                {(p.validFrom || "").slice(0, 10)}
                {p.validTo ? ` → ${p.validTo.slice(0, 10)}` : " → ∞"}
              </td>
              <td style={td}>{p.expenseCaps?.length || 0}</td>
              <td style={td}>
                <Button variant="outline" color="primary" size="small" onClick={() => openEdit(p)}>Editar</Button>{" "}
                <Button variant="outline" color="warning" size="small" onClick={() => onDelete(p)}>Desactivar</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <Modal
          title={editing ? "Editar política" : "Nueva política"}
          message="Configura nombre, vigencia, alcance y topes por tipo de gasto."
          show={modalOpen}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Nombre
              <input {...form.register("name")} />
              {form.formState.errors.name && <small>{form.formState.errors.name.message}</small>}
            </label>
            <label>
              Categoría de empleado
              <Controller name="categoryId" control={form.control} render={({ field }) => (
                <select {...field} value={field.value as any}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.name}</option>)}
                </select>
              )} />
            </label>
            <label>
              Alcance de destino
              <select {...form.register("destinationScope")}>
                {VALID_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Centro de costos<input {...form.register("costsCenter")} maxLength={20} /></label>
            <label>Viático diario (MXN)<input type="number" step="0.01" {...form.register("dailyPerDiem")} /></label>
            <label>Vigencia desde<input type="date" {...form.register("validFrom")} /></label>
            <label>Vigencia hasta<input type="date" {...form.register("validTo")} /></label>

            <fieldset style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
              <legend>Topes por tipo de gasto</legend>
              {fields.map((f, i) => (
                <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <select {...form.register(`caps.${i}.receiptTypeId`)}>
                    {receiptTypes.map((rt) => <option key={rt.receiptTypeId} value={rt.receiptTypeId}>{rt.receiptTypeName}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Tope" {...form.register(`caps.${i}.capAmount`)} />
                  <select {...form.register(`caps.${i}.capUnit`)}>
                    {VALID_CAP_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <Button variant="outline" color="warning" size="small" onClick={() => remove(i)}>Quitar</Button>
                </div>
              ))}
              <Button variant="outline" color="primary" size="small"
                onClick={() => append({ receiptTypeId: receiptTypes[0]?.receiptTypeId || 1, capAmount: 0, capUnit: "per_event", currency: "MXN" })}>
                + Agregar tope
              </Button>
            </fieldset>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <Button variant="outline" color="primary" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="filled" color="primary">{editing ? "Guardar" : "Crear"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };
const td: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #eee" };
