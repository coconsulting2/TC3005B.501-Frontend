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

const VALID_SCOPES = ["nacional", "internacional", "Any"] as const;
const VALID_CAP_UNITS = ["per_night", "per_trip", "per_day", "per_event"] as const;

const policySchema = z.object({
  name: z.string().trim().min(1, "Requerido").max(120, "Máximo 120 caracteres"),
  categoryId: z.union([z.coerce.number().int().positive(), z.literal("")]).optional(),
  destinationScope: z.enum(VALID_SCOPES).default("Any"),
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

interface Props { token: string }

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
  const [receiptTypes] = useState<ReceiptType[]>(RECEIPT_TYPES_FALLBACK);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema) as any,
    defaultValues: {
      name: "", destinationScope: "Any", currency: "MXN",
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
        apiRequest<{ policies: Policy[] }>("/policies", { headers: { Authorization: `Bearer ${_props.token}`}}),
        apiRequest<{ categories: Category[] }>("/employee-categories", { headers: { Authorization: `Bearer ${_props.token}`}}),
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
      name: "", destinationScope: "Any", currency: "MXN",
      validFrom: new Date().toISOString().slice(0, 10), validTo: "", caps: [], categoryId: "" as any,
    });
    setModalOpen(true);
  }

  function openEdit(p: Policy) {
    setEditing(p);
    form.reset({
      name: p.name,
      categoryId: (p.categoryId ?? "") as any,
      destinationScope: (p.destinationScope as any) || "Any",
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
        await apiRequest(`/policies/${editing.policyId}`, { method: "PUT", data: payload, headers: { Authorization: `Bearer ${_props.token}`} });
        setToast({ message: "Política actualizada.", type: "success" });
      } else {
        await apiRequest("/policies", { method: "POST", data: payload, headers: { Authorization: `Bearer ${_props.token}`}});
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
      await apiRequest(`/policies/${p.policyId}`, { method: "DELETE", headers: { Authorization: `Bearer ${_props.token}`}});
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
                <Button variant="border" color="primary" size="small" onClick={() => openEdit(p)}>Editar</Button>{" "}
                <Button variant="border" color="accent" size="small" onClick={() => onDelete(p)}>Desactivar</Button>
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
           <form onSubmit={form.handleSubmit(onSubmit)} className="max-h-10/12" style={{ display: "grid", gap: "1.25rem" }}>
             {/* Nombre */}
             <div style={{ display: "grid", gap: "0.35rem" }}>
               <label style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>
                 Nombre
                 {form.formState.errors.name && <span style={{ color: "#e53e3e", marginLeft: "0.25rem" }}>*</span>}
               </label>
               <input
                 style={getInputStyle(!!form.formState.errors.name)}
                 placeholder="Ej: Política Nacional 2026"
                 {...form.register("name")}
               />
               {form.formState.errors.name && <small style={errorStyle}>{form.formState.errors.name.message}</small>}
             </div>

             {/* Categoría de empleado */}
             <div style={{ display: "grid", gap: "0.35rem" }}>
               <label style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>
                 Categoría de empleado
               </label>
               <Controller
                 name="categoryId"
                 control={form.control}
                 render={({ field }) => (
                   <select
                     style={getSelectStyle(!!form.formState.errors.categoryId)}
                     {...field}
                     value={field.value as any}
                   >
                     <option value="">— Ninguna —</option>
                     {categories.map((c) => (
                       <option key={c.categoryId} value={c.categoryId}>
                         {c.name}
                       </option>
                     ))}
                   </select>
                 )}
               />
               {form.formState.errors.categoryId && (
                 <small style={errorStyle}>{form.formState.errors.categoryId.message}</small>
               )}
             </div>

             {/* Alcance de destino */}
             <div style={{ display: "grid", gap: "0.35rem" }}>
               <label style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>
                 Alcance de destino
               </label>
               <select
                 style={getSelectStyle(!!form.formState.errors.destinationScope)}
                 {...form.register("destinationScope")}
               >
                 <option value="Any">Cualquiera</option>
                 <option value="nacional">Nacional</option>
                 <option value="internacional">Internacional</option>
               </select>
             </div>

             {/* Centro de costos */}
             <div style={{ display: "grid", gap: "0.35rem" }}>
               <label style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>
                 Centro de costos
               </label>
               <input
                 style={getInputStyle(!!form.formState.errors.costsCenter)}
                 placeholder="Ej: CC001"
                 maxLength={20}
                 {...form.register("costsCenter")}
               />
               <small style={helperStyle}>Máximo 20 caracteres (opcional)</small>
             </div>

             {/* Viático diario */}
             <div style={{ display: "grid", gap: "0.35rem" }}>
               <label style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>
                 Viático diario (MXN)
               </label>
               <input
                 type="number"
                 step="0.01"
                 min="0"
                 style={getInputStyle(!!form.formState.errors.dailyPerDiem)}
                 placeholder="0.00"
                 {...form.register("dailyPerDiem")}
               />
               <small style={helperStyle}>Opcionales</small>
             </div>

             {/* Vigencia desde y hasta */}
             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
               <div style={{ display: "grid", gap: "0.35rem" }}>
                 <label style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>
                   Vigencia desde
                   {form.formState.errors.validFrom && <span style={{ color: "#e53e3e", marginLeft: "0.25rem" }}>*</span>}
                 </label>
                 <input
                   type="date"
                   style={getInputStyle(!!form.formState.errors.validFrom)}
                   {...form.register("validFrom")}
                 />
                 <small style={helperStyle}>Requerido</small>
                 {form.formState.errors.validFrom && (
                   <small style={errorStyle}>{form.formState.errors.validFrom.message}</small>
                 )}
               </div>
               <div style={{ display: "grid", gap: "0.35rem" }}>
                 <label style={{ fontWeight: "600", color: "#222", fontSize: "0.9rem" }}>
                   Vigencia hasta
                 </label>
                 <input
                   type="date"
                   style={getInputStyle(!!form.formState.errors.validTo)}
                   {...form.register("validTo")}
                 />
                 <small style={helperStyle}>Opcional</small>
               </div>
             </div>

             {/* Topes por tipo de gasto */}
             <fieldset
               style={{
                 border: "2px solid #e2e8f0",
                 borderRadius: "6px",
                 padding: "1rem",
                 backgroundColor: "#f8fafc",
               }}
             >
               <legend style={{ fontWeight: "600", color: "#222", padding: "0 0.5rem" }}>
                 Topes por tipo de gasto
               </legend>
               <div style={{ display: "grid", gap: "0.75rem" }}>
                 {fields.map((f, i) => (
                   <div
                     key={f.id}
                     style={{
                       display: "grid",
                       gridTemplateColumns: "1fr 1fr 1fr auto",
                       gap: "0.6rem",
                       alignItems: "flex-start",
                       padding: "0.75rem",
                       backgroundColor: "#fff",
                       border: "1px solid #e2e8f0",
                       borderRadius: "4px",
                     }}
                   >
                     <div style={{ display: "grid", gap: "0.25rem" }}>
                       <select
                         style={getSelectStyle(!!form.formState.errors.caps?.[i]?.receiptTypeId)}
                         {...form.register(`caps.${i}.receiptTypeId`)}
                       >
                         {receiptTypes.map((rt) => (
                           <option key={rt.receiptTypeId} value={rt.receiptTypeId}>
                             {rt.receiptTypeName}
                           </option>
                         ))}
                       </select>
                       {form.formState.errors.caps?.[i]?.receiptTypeId && (
                         <small style={errorStyle}>Requerido</small>
                       )}
                     </div>
                     <div style={{ display: "grid", gap: "0.25rem" }}>
                       <input
                         type="number"
                         step="0.01"
                         min="0"
                         style={getInputStyle(!!form.formState.errors.caps?.[i]?.capAmount)}
                         placeholder="Tope"
                         {...form.register(`caps.${i}.capAmount`)}
                       />
                       {form.formState.errors.caps?.[i]?.capAmount && (
                         <small style={errorStyle}>Mín. 0</small>
                       )}
                     </div>
                     <div style={{ display: "grid", gap: "0.25rem" }}>
                       <select
                         style={getSelectStyle(!!form.formState.errors.caps?.[i]?.capUnit)}
                         {...form.register(`caps.${i}.capUnit`)}
                       >
                         <option value="per_night">Por noche</option>
                         <option value="per_trip">Por viaje</option>
                         <option value="per_day">Por día</option>
                         <option value="per_event">Por evento</option>
                       </select>
                       {form.formState.errors.caps?.[i]?.capUnit && (
                         <small style={errorStyle}>Requerido</small>
                       )}
                     </div>
                     <div style={{ paddingTop: "0.35rem" }}>
                       <Button
                         variant="border"
                         color="accent"
                         size="small"
                         onClick={() => remove(i)}
                       >
                         Quitar
                       </Button>
                     </div>
                   </div>
                 ))}
                 <Button
                   variant="border"
                   color="primary"
                   size="small"
                   onClick={() =>
                     append({
                       receiptTypeId: receiptTypes[0]?.receiptTypeId || 1,
                       capAmount: 0,
                       capUnit: "per_event",
                       currency: "MXN",
                     })
                   }
                 >
                   + Agregar tope
                 </Button>
               </div>
             </fieldset>

             {/* Botones de acción */}
             <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
               <Button variant="border" color="primary" onClick={() => setModalOpen(false)}>
                 Cancelar
               </Button>
               <Button type="submit" variant="filled" color="primary">
                 {editing ? "Guardar cambios" : "Crear política"}
               </Button>
             </div>
           </form>
         </Modal>
       )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

// Estilos de tabla
const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd", fontWeight: "600" };
const td: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #eee" };

// Estilos de formulario
const labelStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "0.5rem",
  alignItems: "flex-start",
  fontSize: "0.9rem",
  fontWeight: "500",
  color: "#333",
};

const getInputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "0.6rem 0.75rem",
  fontSize: "0.95rem",
  border: `2px solid ${hasError ? "#e53e3e" : "#d0d0d0"}`,
  borderRadius: "4px",
  fontFamily: "inherit",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  backgroundColor: hasError ? "rgba(229, 62, 62, 0.05)" : "#fff",
  boxShadow: hasError ? "0 0 0 3px rgba(229, 62, 62, 0.1)" : "none",
});

const getSelectStyle = (hasError: boolean): React.CSSProperties => ({
  ...getInputStyle(hasError),
  cursor: "pointer",
  appearance: "none",
  paddingRight: "2rem",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.75rem center",
});

const errorStyle: React.CSSProperties = {
  color: "#e53e3e",
  fontSize: "0.8rem",
  marginTop: "0.25rem",
  fontWeight: "500",
};

const helperStyle: React.CSSProperties = {
  color: "#666",
  fontSize: "0.8rem",
  marginTop: "0.25rem",
};

