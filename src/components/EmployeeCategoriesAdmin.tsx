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
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: "0.75rem" }}>
            <label>Código<input {...form.register("code")} maxLength={40} />
              {form.formState.errors.code && <small>{form.formState.errors.code.message}</small>}
            </label>
            <label>Nombre<input {...form.register("name")} maxLength={80} />
              {form.formState.errors.name && <small>{form.formState.errors.name.message}</small>}
            </label>
            <label>Descripción<textarea {...form.register("description")} rows={3} maxLength={254} /></label>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
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

const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };
const td: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #eee" };
