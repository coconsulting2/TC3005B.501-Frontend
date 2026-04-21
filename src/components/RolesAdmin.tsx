/**
 * RolesAdmin — CRUD for roles and permissions (M2-003).
 * Validates that at least one admin role always exists and warns before
 * deleting a role that has active users.
 *
 * Currently runs on local seed data; pass `apiEndpoint` to wire to the
 * real backend once M2-00x ships.
 */

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@components/Button";
import Modal from "@components/Modal";
import Toast from "@components/Toast";
import {
  ADMIN_PERMISSION_CODE,
  ALL_PERMISSION_CODES,
  PERMISSIONS_CATALOG,
} from "@config/permissionsCatalog";
import type { Role } from "@type/Role";
import { apiRequest } from "@utils/apiClient";

const SEED_ROLES: Role[] = [
  {
    role_id: 1,
    name: "Administrador",
    permissions: ALL_PERMISSION_CODES,
    max_authorization_amount: null,
    expiration_date: null,
    is_admin: true,
    active_users_count: 2,
  },
  {
    role_id: 2,
    name: "Autorizador N1",
    permissions: [
      "viajes.solicitud.crear",
      "viajes.autorizar.n1",
      "gastos.aprobar",
      "reportes.ver",
    ],
    max_authorization_amount: 25000,
    expiration_date: null,
    is_admin: false,
    active_users_count: 4,
  },
  {
    role_id: 3,
    name: "Autorizador N2",
    permissions: [
      "viajes.solicitud.crear",
      "viajes.autorizar.n1",
      "viajes.autorizar.n2",
      "gastos.aprobar",
      "gastos.rechazar",
      "reportes.ver",
      "reportes.exportar",
    ],
    max_authorization_amount: 100000,
    expiration_date: null,
    is_admin: false,
    active_users_count: 2,
  },
  {
    role_id: 4,
    name: "Solicitante",
    permissions: [
      "viajes.solicitud.crear",
      "viajes.solicitud.editar",
      "viajes.solicitud.cancelar",
      "gastos.comprobante.subir",
    ],
    max_authorization_amount: 0,
    expiration_date: null,
    is_admin: false,
    active_users_count: 18,
  },
];

const roleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(50, "Máximo 50 caracteres"),
    permissions: z.array(z.string()),
    max_authorization_amount: z.union([
      z.number().min(0, "No puede ser negativo"),
      z.literal(""),
    ]),
    expiration_date: z.string(),
    is_admin: z.boolean(),
  })
  .refine((data) => !data.is_admin || data.permissions.includes(ADMIN_PERMISSION_CODE), {
    message: "Un rol admin debe incluir el permiso 'Gestionar roles y permisos'",
    path: ["permissions"],
  });

type RoleFormValues = z.infer<typeof roleSchema>;

type Dialog =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; role: Role }
  | { kind: "delete"; role: Role };

interface RolesAdminProps {
  initialData?: Role[];
  apiEndpoint?: string;
  token?: string;
}

const defaultFormValues: RoleFormValues = {
  name: "",
  permissions: [],
  max_authorization_amount: "",
  expiration_date: "",
  is_admin: false,
};

export default function RolesAdmin({
  initialData,
  apiEndpoint,
  token,
}: RolesAdminProps) {
  const [roles, setRoles] = useState<Role[]>(initialData ?? SEED_ROLES);
  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: defaultFormValues,
  });

  const selectedPermissions = watch("permissions") ?? [];
  const isAdminWatched = watch("is_admin");

  useEffect(() => {
    if (!apiEndpoint) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<Role[]>(apiEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!cancelled && Array.isArray(data)) setRoles(data);
      } catch (err) {
        console.warn("[RolesAdmin] fetch failed, using seed data", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiEndpoint, token]);

  const adminCount = useMemo(
    () => roles.filter((r) => r.is_admin).length,
    [roles]
  );

  const openCreate = () => {
    reset(defaultFormValues);
    setDialog({ kind: "create" });
  };

  const openEdit = (role: Role) => {
    reset({
      name: role.name,
      permissions: [...role.permissions],
      max_authorization_amount:
        role.max_authorization_amount ?? ("" as const),
      expiration_date: role.expiration_date ?? "",
      is_admin: role.is_admin,
    });
    setDialog({ kind: "edit", role });
  };

  const closeDialog = () => {
    setDialog({ kind: "closed" });
    setSubmitting(false);
  };

  const togglePermission = (code: string) => {
    const current = selectedPermissions;
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setValue("permissions", next, { shouldValidate: true, shouldDirty: true });
  };

  const toggleModule = (moduleCodes: string[]) => {
    const current = new Set(selectedPermissions);
    const allSelected = moduleCodes.every((c) => current.has(c));
    if (allSelected) {
      moduleCodes.forEach((c) => current.delete(c));
    } else {
      moduleCodes.forEach((c) => current.add(c));
    }
    setValue("permissions", Array.from(current), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const onSubmit = async (values: RoleFormValues) => {
    const parsed = {
      name: values.name,
      permissions: values.permissions,
      max_authorization_amount:
        values.max_authorization_amount === ""
          ? null
          : values.max_authorization_amount,
      expiration_date:
        values.expiration_date && values.expiration_date.trim()
          ? values.expiration_date
          : null,
      is_admin: values.is_admin,
    };

    if (dialog.kind === "edit" && dialog.role.is_admin && !parsed.is_admin) {
      if (adminCount <= 1) {
        setToast({
          message: "No puedes quitar el último rol administrador del sistema.",
          type: "error",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      if (dialog.kind === "create") {
        const payload = {
          name: parsed.name,
          permissions: parsed.permissions,
          max_authorization_amount: parsed.max_authorization_amount ?? null,
          expiration_date: parsed.expiration_date ?? null,
          is_admin: parsed.is_admin,
        };
        let created: Role | null = null;
        if (apiEndpoint) {
          try {
            created = await apiRequest<Role>(apiEndpoint, {
              method: "POST",
              data: payload,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
          } catch (err) {
            console.warn("[RolesAdmin] create failed, using local state", err);
          }
        }
        const nextId =
          created?.role_id ??
          roles.reduce((m, r) => Math.max(m, r.role_id), 0) + 1;
        setRoles((prev) => [
          ...prev,
          created ?? {
            role_id: nextId,
            active_users_count: 0,
            ...payload,
          },
        ]);
        setToast({ message: "Rol creado correctamente", type: "success" });
      } else if (dialog.kind === "edit") {
        const payload = {
          name: parsed.name,
          permissions: parsed.permissions,
          max_authorization_amount: parsed.max_authorization_amount ?? null,
          expiration_date: parsed.expiration_date ?? null,
          is_admin: parsed.is_admin,
        };
        if (apiEndpoint) {
          try {
            await apiRequest(`${apiEndpoint}/${dialog.role.role_id}`, {
              method: "PUT",
              data: payload,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
          } catch (err) {
            console.warn("[RolesAdmin] update failed, using local state", err);
          }
        }
        setRoles((prev) =>
          prev.map((r) =>
            r.role_id === dialog.role.role_id ? { ...r, ...payload } : r
          )
        );
        setToast({ message: "Rol actualizado", type: "success" });
      }
      closeDialog();
    } catch (err) {
      console.error(err);
      setToast({ message: "Error al guardar el rol", type: "error" });
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (dialog.kind !== "delete") return;
    const role = dialog.role;

    if (role.is_admin && adminCount <= 1) {
      setToast({
        message: "No puedes eliminar el último rol administrador del sistema.",
        type: "error",
      });
      closeDialog();
      return;
    }

    setSubmitting(true);
    if (apiEndpoint) {
      try {
        await apiRequest(`${apiEndpoint}/${role.role_id}`, {
          method: "PUT",
          data: { active: false },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      } catch (err) {
        console.warn("[RolesAdmin] delete failed, using local state", err);
      }
    }
    setRoles((prev) => prev.filter((r) => r.role_id !== role.role_id));
    setToast({ message: `Rol "${role.name}" eliminado`, type: "success" });
    closeDialog();
  };

  const dialogOpen = dialog.kind !== "closed";
  const isFormDialog = dialog.kind === "create" || dialog.kind === "edit";
  const editingRole = dialog.kind === "edit" ? dialog.role : null;
  const deletingRole = dialog.kind === "delete" ? dialog.role : null;
  const deletingHasUsers = !!deletingRole && deletingRole.active_users_count > 0;
  const deletingIsLastAdmin =
    !!deletingRole && deletingRole.is_admin && adminCount <= 1;

  const dialogTitle =
    dialog.kind === "create"
      ? "Nuevo rol"
      : dialog.kind === "edit"
      ? `Editar rol: ${dialog.role.name}`
      : dialog.kind === "delete"
      ? "Eliminar rol"
      : "";

  const deleteMessage = deletingRole
    ? deletingIsLastAdmin
      ? `No se puede eliminar "${deletingRole.name}" porque es el último rol administrador del sistema.`
      : deletingHasUsers
      ? `El rol "${deletingRole.name}" tiene ${deletingRole.active_users_count} usuario${
          deletingRole.active_users_count === 1 ? "" : "s"
        } activo${
          deletingRole.active_users_count === 1 ? "" : "s"
        }. Si continúas, esos usuarios quedarán sin rol asignado. ¿Deseas continuar?`
      : `¿Confirmas eliminar el rol "${deletingRole.name}"? Esta acción no se puede deshacer.`
    : "";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {roles.length} {roles.length === 1 ? "rol registrado" : "roles registrados"} ·
          {" "}
          {adminCount} administrador{adminCount === 1 ? "" : "es"}
        </p>
        <Button type="button" variant="filled" color="primary" onClick={openCreate}>
          + Nuevo rol
        </Button>
      </div>

      <section className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                <th className="px-6 py-3 text-left eyebrow">Rol</th>
                <th className="px-6 py-3 text-left eyebrow hidden md:table-cell">
                  Permisos
                </th>
                <th className="px-6 py-3 text-left eyebrow hidden sm:table-cell">
                  Monto máx.
                </th>
                <th className="px-6 py-3 text-left eyebrow hidden lg:table-cell">
                  Usuarios
                </th>
                <th className="px-6 py-3 text-right eyebrow">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-[var(--color-ink-muted)]"
                  >
                    No hay roles registrados.
                  </td>
                </tr>
              ) : (
                roles.map((role, idx) => {
                  const isLast = idx === roles.length - 1;
                  return (
                    <tr
                      key={role.role_id}
                      className={`${
                        !isLast ? "border-b border-[var(--color-neutral-200)]" : ""
                      } hover:bg-[var(--color-surface-secondary)] transition-colors`}
                    >
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--color-ink)]">
                            {role.name}
                          </span>
                          {role.is_admin && (
                            <span className="status-pill bg-primary-50 text-primary-500">
                              Admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink-muted)] hidden md:table-cell tabular-nums">
                        {role.permissions.length} / {ALL_PERMISSION_CODES.length}
                      </td>
                      <td className="px-6 py-4 text-sm hidden sm:table-cell money-display">
                        {role.max_authorization_amount == null
                          ? "—"
                          : new Intl.NumberFormat("es-MX", {
                              style: "currency",
                              currency: "MXN",
                              maximumFractionDigits: 0,
                            }).format(role.max_authorization_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink-muted)] hidden lg:table-cell tabular-nums">
                        {role.active_users_count}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(role)}
                            className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "delete", role })}
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
        message={dialog.kind === "delete" ? deleteMessage : ""}
        type={dialog.kind === "delete" ? "warning" : "confirm"}
        onClose={closeDialog}
        onConfirm={
          isFormDialog
            ? handleSubmit(onSubmit)
            : deletingIsLastAdmin
            ? undefined
            : handleDelete
        }
        confirmLabel={
          submitting
            ? "Guardando..."
            : dialog.kind === "delete"
            ? "Eliminar de todos modos"
            : dialog.kind === "edit"
            ? "Actualizar"
            : "Crear rol"
        }
        cancelLabel={dialog.kind === "delete" && deletingIsLastAdmin ? "Cerrar" : "Cancelar"}
      >
        {isFormDialog && (
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Nombre del rol <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                {...register("name")}
                placeholder="Ej: Autorizador Regional"
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.name
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
                autoFocus
              />
              {errors.name && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                  Monto máximo de autorización{" "}
                  <span className="text-[var(--color-ink-muted)]">(MXN)</span>
                </label>
                <Controller
                  control={control}
                  name="max_authorization_amount"
                  render={({ field }) => (
                    <input
                      type="number"
                      min={0}
                      step="100"
                      placeholder="0 = no autoriza"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                        errors.max_authorization_amount
                          ? "border-accent-400"
                          : "border-[var(--color-neutral-300)]"
                      }`}
                    />
                  )}
                />
                {errors.max_authorization_amount && (
                  <p className="text-accent-400 text-xs mt-1">
                    {errors.max_authorization_amount.message as string}
                  </p>
                )}
                <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                  Déjalo vacío para autorización ilimitada.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                  Fecha de expiración{" "}
                  <span className="text-[var(--color-ink-muted)]">(opcional)</span>
                </label>
                <input
                  type="date"
                  {...register("expiration_date")}
                  className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                    errors.expiration_date
                      ? "border-accent-400"
                      : "border-[var(--color-neutral-300)]"
                  }`}
                />
                {errors.expiration_date && (
                  <p className="text-accent-400 text-xs mt-1">
                    {errors.expiration_date.message as string}
                  </p>
                )}
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("is_admin")}
                className="mt-1 accent-[var(--color-primary-500,#3D4A2A)]"
              />
              <span className="text-sm text-[var(--color-ink-secondary)]">
                Este rol es administrador del sistema.
                {editingRole?.is_admin && adminCount <= 1 && (
                  <span className="block text-xs text-accent-400 mt-0.5">
                    No puedes quitar este flag: es el único rol admin del sistema.
                  </span>
                )}
              </span>
            </label>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-[var(--color-ink-secondary)]">
                  Permisos{" "}
                  <span className="text-[var(--color-ink-muted)]">
                    ({selectedPermissions.length}/{ALL_PERMISSION_CODES.length})
                  </span>
                </label>
                {errors.permissions && typeof errors.permissions.message === "string" && (
                  <p className="text-accent-400 text-xs">
                    {errors.permissions.message}
                  </p>
                )}
              </div>

              <div className="border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] divide-y divide-[var(--color-neutral-200)] max-h-72 overflow-y-auto">
                {PERMISSIONS_CATALOG.map((module) => {
                  const moduleCodes = module.permissions.map((p) => p.code);
                  const selectedInModule = moduleCodes.filter((c) =>
                    selectedPermissions.includes(c)
                  ).length;
                  const allSelected = selectedInModule === moduleCodes.length;

                  return (
                    <div key={module.key} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="eyebrow">{module.label}</p>
                          <p className="text-xs text-[var(--color-ink-muted)] tabular-nums">
                            {selectedInModule}/{moduleCodes.length}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleModule(moduleCodes)}
                          className="text-xs text-primary-500 hover:text-primary-400 font-medium cursor-pointer"
                        >
                          {allSelected ? "Quitar todos" : "Seleccionar todos"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {module.permissions.map((perm) => {
                          const checked = selectedPermissions.includes(perm.code);
                          const isAdminCode = perm.code === ADMIN_PERMISSION_CODE;
                          return (
                            <label
                              key={perm.code}
                              className="flex items-start gap-2 text-sm cursor-pointer hover:bg-[var(--color-surface-secondary)] rounded px-1.5 py-1"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(perm.code)}
                                disabled={isAdminWatched && isAdminCode}
                                className="mt-1 accent-[var(--color-primary-500,#3D4A2A)]"
                              />
                              <span className="text-[var(--color-ink)]">
                                {perm.label}
                                {isAdminCode && isAdminWatched && (
                                  <span className="block text-xs text-[var(--color-ink-muted)]">
                                    Requerido para roles admin
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        )}

        {dialog.kind === "delete" && deletingHasUsers && !deletingIsLastAdmin && (
          <div className="border-l-4 border-warning-400 bg-warning-50 p-3 rounded-[var(--radius-md)] text-sm text-warning-500">
            ⚠ Este rol tiene usuarios activos. Deberás reasignarles un rol antes
            de que puedan iniciar sesión de nuevo.
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
