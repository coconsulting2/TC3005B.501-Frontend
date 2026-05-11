/**
 * AccountingAccountAdmin — CRUD view for the accounting catalog (M3-007).
 *
 * Lets the accounting admin register, edit and disable accounting accounts.
 * Accounts already referenced by an active ExpenseTypeMapping cannot be
 * deleted; the UI surfaces this with a disabled action and a tooltip.
 *
 * Currently operates on client-side seed state; pass `apiEndpoint` /
 * `mappingsEndpoint` to wire to the real backend once M3 ships the
 * /admin/accounting-accounts and /admin/expense-mappings endpoints
 * (filtered by orgId on the server).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@components/Button";
import Modal from "@components/Modal";
import Toast from "@components/Toast";
import {
  ACCOUNT_TYPE_LABEL,
  getMappedAccountIds,
} from "@type/AccountingAccount";
import type {
  AccountingAccount,
  AccountingAccountFormErrors,
  AccountingAccountFormValues,
  AccountingAccountType,
  ExpenseTypeMapping,
} from "@type/AccountingAccount";
import { apiRequest } from "@utils/apiClient";

interface AccountingAccountAdminProps {
  initialData?: AccountingAccount[];
  initialMappings?: ExpenseTypeMapping[];
  apiEndpoint?: string;
  mappingsEndpoint?: string;
  token?: string;
}

type Dialog =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; account: AccountingAccount }
  | { kind: "delete"; account: AccountingAccount };

const SEED_ACCOUNTS: AccountingAccount[] = [
  {
    accounting_account_id: 1,
    org_id: 1,
    account_number: "6100-001",
    name: "Gastos de viaje · Avión",
    type: "cargo",
  },
  {
    accounting_account_id: 2,
    org_id: 1,
    account_number: "6100-002",
    name: "Gastos de viaje · Hotel",
    type: "cargo",
  },
  {
    accounting_account_id: 3,
    org_id: 1,
    account_number: "6100-003",
    name: "Gastos de viaje · Alimentos",
    type: "cargo",
  },
  {
    accounting_account_id: 4,
    org_id: 1,
    account_number: "1107-001",
    name: "IVA acreditable por aplicar",
    type: "cargo",
  },
  {
    accounting_account_id: 5,
    org_id: 1,
    account_number: "2102-001",
    name: "Cuentas por pagar · Proveedores",
    type: "abono",
  },
  {
    accounting_account_id: 6,
    org_id: 1,
    account_number: "1102-001",
    name: "Bancos · Cuenta operativa",
    type: "abono",
  },
];

const SEED_MAPPINGS: ExpenseTypeMapping[] = [
  {
    expense_type_mapping_id: 1,
    org_id: 1,
    receipt_type_id: 1,
    cargo_account_id: 1,
    abono_account_id: 5,
    tax_indicator_id: 1,
  },
  {
    expense_type_mapping_id: 2,
    org_id: 1,
    receipt_type_id: 2,
    cargo_account_id: 2,
    abono_account_id: 5,
    tax_indicator_id: 1,
  },
];

const TYPE_OPTIONS: AccountingAccountType[] = ["cargo", "abono", "ambos"];

const emptyForm: AccountingAccountFormValues = {
  account_number: "",
  name: "",
  type: "cargo",
};

export default function AccountingAccountAdmin({
  initialData,
  initialMappings,
  apiEndpoint,
  mappingsEndpoint,
  token,
}: AccountingAccountAdminProps) {
  const [items, setItems] = useState<AccountingAccount[]>(
    initialData ?? SEED_ACCOUNTS
  );
  const [mappings, setMappings] = useState<ExpenseTypeMapping[]>(
    initialMappings ?? SEED_MAPPINGS
  );
  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const [form, setForm] = useState<AccountingAccountFormValues>(emptyForm);
  const [errors, setErrors] = useState<AccountingAccountFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<
    { message: string; type: "success" | "error" } | null
  >(null);

  useEffect(() => {
    if (!apiEndpoint) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<AccountingAccount[]>(apiEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!cancelled && Array.isArray(data)) setItems(data);
      } catch (err) {
        console.warn(
          "[AccountingAccountAdmin] fetch failed, using seed data",
          err
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiEndpoint, token]);

  useEffect(() => {
    if (!mappingsEndpoint) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<ExpenseTypeMapping[]>(mappingsEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!cancelled && Array.isArray(data)) setMappings(data);
      } catch (err) {
        console.warn(
          "[AccountingAccountAdmin] mappings fetch failed, using seed data",
          err
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mappingsEndpoint, token]);

  const mappedIds = useMemo(() => getMappedAccountIds(mappings), [mappings]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.account_number.localeCompare(b.account_number, "es", {
          sensitivity: "base",
        })
      ),
    [items]
  );

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setDialog({ kind: "create" });
  };

  const openEdit = (account: AccountingAccount) => {
    setForm({
      account_number: account.account_number,
      name: account.name,
      type: account.type,
    });
    setErrors({});
    setDialog({ kind: "edit", account });
  };

  const closeDialog = () => {
    setDialog({ kind: "closed" });
    setErrors({});
    setSubmitting(false);
  };

  const validate = useCallback(
    (
      values: AccountingAccountFormValues,
      editingId?: number
    ): AccountingAccountFormErrors => {
      const next: AccountingAccountFormErrors = {};
      const accountNumber = values.account_number.trim();
      const name = values.name.trim();

      if (!accountNumber) next.account_number = "El número de cuenta es requerido";
      else if (!/^[A-Za-z0-9_-]{3,20}$/.test(accountNumber))
        next.account_number = "3–20 caracteres: letras, números, guion o guion bajo";
      else if (
        items.some(
          (i) =>
            i.account_number.toLowerCase() === accountNumber.toLowerCase() &&
            i.accounting_account_id !== editingId
        )
      )
        next.account_number = "Este número de cuenta ya existe";

      if (!name) next.name = "El nombre es requerido";
      else if (name.length > 80) next.name = "Máximo 80 caracteres";

      if (!TYPE_OPTIONS.includes(values.type)) next.type = "Tipo inválido";

      return next;
    },
    [items]
  );

  const handleSubmit = async () => {
    const editingId =
      dialog.kind === "edit" ? dialog.account.accounting_account_id : undefined;
    const nextErrors = validate(form, editingId);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (dialog.kind === "create") {
        const payload = {
          account_number: form.account_number.trim(),
          name: form.name.trim(),
          type: form.type,
        };
        let created: AccountingAccount | null = null;
        if (apiEndpoint) {
          try {
            created = await apiRequest<AccountingAccount>(apiEndpoint, {
              method: "POST",
              data: payload,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
          } catch (err) {
            console.warn(
              "[AccountingAccountAdmin] create failed, using local state",
              err
            );
          }
        }
        const nextId =
          created?.accounting_account_id ??
          items.reduce((m, i) => Math.max(m, i.accounting_account_id), 0) + 1;
        const orgId = created?.org_id ?? items[0]?.org_id ?? 1;
        setItems((prev) => [
          ...prev,
          created ?? {
            accounting_account_id: nextId,
            org_id: orgId,
            ...payload,
          },
        ]);
        setToast({ message: "Cuenta contable creada", type: "success" });
      } else if (dialog.kind === "edit") {
        const payload = {
          account_number: form.account_number.trim(),
          name: form.name.trim(),
          type: form.type,
        };
        if (apiEndpoint) {
          try {
            await apiRequest(
              `${apiEndpoint}/${dialog.account.accounting_account_id}`,
              {
                method: "PUT",
                data: payload,
                headers: token
                  ? { Authorization: `Bearer ${token}` }
                  : undefined,
              }
            );
          } catch (err) {
            console.warn(
              "[AccountingAccountAdmin] update failed, using local state",
              err
            );
          }
        }
        setItems((prev) =>
          prev.map((i) =>
            i.accounting_account_id === dialog.account.accounting_account_id
              ? { ...i, ...payload }
              : i
          )
        );
        setToast({ message: "Cuenta contable actualizada", type: "success" });
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
    const id = dialog.account.accounting_account_id;

    if (mappedIds.has(id)) {
      setToast({
        message:
          "No se puede eliminar: la cuenta está mapeada a un tipo de gasto activo.",
        type: "error",
      });
      closeDialog();
      return;
    }

    setSubmitting(true);
    if (apiEndpoint) {
      try {
        await apiRequest(`${apiEndpoint}/${id}`, {
          method: "PUT",
          data: { active: false },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      } catch (err) {
        console.warn(
          "[AccountingAccountAdmin] delete failed, using local state",
          err
        );
      }
    }
    setItems((prev) => prev.filter((i) => i.accounting_account_id !== id));
    setToast({ message: "Cuenta contable eliminada", type: "success" });
    closeDialog();
  };

  const dialogOpen = dialog.kind !== "closed";
  const isFormDialog = dialog.kind === "create" || dialog.kind === "edit";
  const deletingAccount = dialog.kind === "delete" ? dialog.account : null;
  const deletingIsMapped =
    !!deletingAccount && mappedIds.has(deletingAccount.accounting_account_id);

  const dialogTitle =
    dialog.kind === "create"
      ? "Nueva cuenta contable"
      : dialog.kind === "edit"
        ? `Editar cuenta: ${dialog.account.account_number}`
        : dialog.kind === "delete"
          ? "Eliminar cuenta contable"
          : "";

  const deleteMessage = deletingAccount
    ? deletingIsMapped
      ? `No se puede eliminar "${deletingAccount.account_number} · ${deletingAccount.name}" porque está mapeada a un tipo de gasto activo. Quita el mapeo primero.`
      : `¿Confirmas eliminar "${deletingAccount.account_number} · ${deletingAccount.name}"? Esta acción no se puede deshacer.`
    : "";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {sortedItems.length}{" "}
          {sortedItems.length === 1 ? "cuenta registrada" : "cuentas registradas"} ·
          {" "}
          {mappedIds.size}{" "}
          {mappedIds.size === 1 ? "en uso" : "en uso"}
        </p>
        <Button
          type="button"
          variant="filled"
          color="primary"
          onClick={openCreate}
        >
          + Nueva cuenta
        </Button>
      </div>

      <section className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                <th className="px-6 py-3 text-left eyebrow">Número</th>
                <th className="px-6 py-3 text-left eyebrow">Nombre</th>
                <th className="px-6 py-3 text-left eyebrow hidden sm:table-cell">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left eyebrow hidden md:table-cell">
                  Estado
                </th>
                <th className="px-6 py-3 text-right eyebrow">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-[var(--color-ink-muted)]"
                  >
                    No hay cuentas contables registradas.
                  </td>
                </tr>
              ) : (
                sortedItems.map((account, idx) => {
                  const isLast = idx === sortedItems.length - 1;
                  const inUse = mappedIds.has(account.accounting_account_id);
                  return (
                    <tr
                      key={account.accounting_account_id}
                      className={`${
                        !isLast
                          ? "border-b border-[var(--color-neutral-200)]"
                          : ""
                      } hover:bg-[var(--color-surface-secondary)] transition-colors`}
                    >
                      <td className="px-6 py-4 text-sm tabular-nums text-[var(--color-ink)] font-medium">
                        {account.account_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink)]">
                        {account.name}
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="status-pill bg-[var(--color-surface-secondary)] text-[var(--color-ink-secondary)]">
                          {ACCOUNT_TYPE_LABEL[account.type]}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        {inUse ? (
                          <span className="status-pill bg-primary-50 text-primary-500">
                            En uso
                          </span>
                        ) : (
                          <span className="status-pill bg-[var(--color-surface-secondary)] text-[var(--color-ink-muted)]">
                            Libre
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(account)}
                            className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "delete", account })
                            }
                            disabled={inUse}
                            title={
                              inUse
                                ? "La cuenta está mapeada a un tipo de gasto activo"
                                : undefined
                            }
                            className={`text-sm font-medium transition-colors ${
                              inUse
                                ? "text-[var(--color-ink-muted)] cursor-not-allowed"
                                : "text-accent-400 hover:text-accent-300 cursor-pointer"
                            }`}
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
            ? handleSubmit
            : deletingIsMapped
              ? undefined
              : handleDelete
        }
        confirmLabel={
          submitting
            ? "Guardando..."
            : dialog.kind === "delete"
              ? "Eliminar"
              : dialog.kind === "edit"
                ? "Actualizar"
                : "Crear"
        }
        cancelLabel={
          dialog.kind === "delete" && deletingIsMapped ? "Cerrar" : "Cancelar"
        }
      >
        {isFormDialog && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Número de cuenta <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                value={form.account_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, account_number: e.target.value }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors tabular-nums ${
                  errors.account_number
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
                placeholder="6100-001"
                autoFocus
              />
              {errors.account_number && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.account_number}
                </p>
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
                placeholder="Gastos de viaje · Avión"
              />
              {errors.name && (
                <p className="text-accent-400 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Tipo <span className="text-accent-400">*</span>
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as AccountingAccountType,
                  }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.type
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              {errors.type && (
                <p className="text-accent-400 text-xs mt-1">{errors.type}</p>
              )}
              <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                "Cargo" se usa al registrar el gasto; "Abono" al pagarlo.
              </p>
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
