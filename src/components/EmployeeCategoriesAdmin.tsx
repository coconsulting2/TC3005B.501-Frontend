/**
 * EmployeeCategoriesAdmin — CRUD de categorías de empleado (M2-006).
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@components/Button";
import Modal from "@components/Modal";
import Toast from "@components/Toast";
import { apiRequest } from "@utils/apiClient";

const categorySchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(254).optional().nullable(),
});
type CategoryFormData = z.infer<typeof categorySchema>;

interface Category {
  categoryId: number;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}

/**
 * @param {{ token?: string }} _props
 */
export default function EmployeeCategoriesAdmin(_props: { token?: string }) {
  const [items, setItems] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { code: "", name: "", description: "" },
  });

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const r = await apiRequest<{ categories: Category[] }>("/employee-categories");
      setItems(r.categories || []);
    } catch {
      setToast({ message: "Error al cargar categorías", type: "error" });
    }
  }

  function openCreate() {
    setEditing(null);
    form.reset({ code: "", name: "", description: "" });
    setModalOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    form.reset({ code: c.code, name: c.name, description: c.description || "" });
    setModalOpen(true);
  }

  async function onSubmit(values: CategoryFormData) {
    try {
      if (editing) {
        await apiRequest(`/employee-categories/${editing.categoryId}`, { method: "PUT", data: values });
        setToast({ message: "Categoría actualizada.", type: "success" });
      } else {
        await apiRequest("/employee-categories", { method: "POST", data: values });
        setToast({ message: "Categoría creada.", type: "success" });
      }
      setModalOpen(false);
      void load();
    } catch (e: any) {
      setToast({ message: e?.detail?.response?.error || "Error al guardar.", type: "error" });
    }
  }

  async function onDelete(c: Category) {
    if (!confirm(`¿Desactivar la categoría "${c.name}"?`)) return;
    try {
      await apiRequest(`/employee-categories/${c.categoryId}`, { method: "DELETE" });
      void load();
    } catch (e: any) {
      setToast({ message: e?.detail?.response?.error || "Error", type: "error" });
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <p style={{ margin: 0 }}>{items.length} categorías</p>
        <Button variant="filled" color="primary" onClick={openCreate}>+ Nueva categoría</Button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>Código</th><th style={th}>Nombre</th><th style={th}>Descripción</th><th style={th}>Acciones</th></tr></thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.categoryId}>
              <td style={td}>{c.code}</td>
              <td style={td}>{c.name}</td>
              <td style={td}>{c.description || "—"}</td>
              <td style={td}>
                <Button variant="border" color="primary" size="small" onClick={() => openEdit(c)}>Editar</Button>{" "}
                <Button variant="border" color="accent" size="small" onClick={() => onDelete(c)}>Desactivar</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <Modal
          title={editing ? "Editar categoría" : "Nueva categoría"}
          message="Define el código y nombre de la categoría de empleado."
          show={modalOpen}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label style={{ fontWeight: 600, color: "#222", fontSize: "0.9rem" }}>
                Código{form.formState.errors.code && <span style={{ color: "#e53e3e", marginLeft: "0.25rem" }}>*</span>}
              </label>
              <input
                style={getInputStyle(!!form.formState.errors.code)}
                placeholder="Ej: CAT-001"
                maxLength={40}
                {...form.register("code")}
              />
              {form.formState.errors.code && <small style={errorStyle}>{form.formState.errors.code.message}</small>}
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label style={{ fontWeight: 600, color: "#222", fontSize: "0.9rem" }}>
                Nombre{form.formState.errors.name && <span style={{ color: "#e53e3e", marginLeft: "0.25rem" }}>*</span>}
              </label>
              <input
                style={getInputStyle(!!form.formState.errors.name)}
                placeholder="Ej: Administrativo"
                maxLength={80}
                {...form.register("name")}
              />
              {form.formState.errors.name && <small style={errorStyle}>{form.formState.errors.name.message}</small>}
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label style={{ fontWeight: 600, color: "#222", fontSize: "0.9rem" }}>Descripción</label>
              <textarea
                style={{ padding: "0.6rem 0.75rem", borderRadius: 4, border: "1px solid #d0d0d0", fontFamily: "inherit" }}
                rows={3}
                maxLength={254}
                {...form.register("description")}
              />
              <small style={helperStyle}>Opcional</small>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.25rem" }}>
              <Button variant="border" color="primary" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="filled" color="primary">{editing ? "Guardar" : "Crear"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd", fontWeight: "600" };
const td: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #eee" };

// Estilos reutilizables del formulario (coinciden con ExpensePoliciesAdmin)
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
