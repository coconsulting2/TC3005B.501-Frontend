/**
 * ExpenseTypeMappingAdmin — Associates each ReceiptType (Avión, Hotel, …)
 * to a cargo and abono accounting account, plus an optional tax indicator.
 *
 * Reuses the accounting catalog managed by AccountingAccountAdmin. The
 * cargo dropdown filters accounts whose `type` is "cargo" or "ambos", and
 * the abono dropdown filters "abono" or "ambos". The form enforces that
 * cargo and abono are different accounts.
 *
 * Currently runs on seed data; wire `apiEndpoint`, `accountsEndpoint`,
 * `receiptTypesEndpoint` and `taxIndicatorsEndpoint` to the M3 backend
 * once it is available (all filtered by orgId on the server).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@components/Button";
import Modal from "@components/Modal";
import Toast from "@components/Toast";
import type {
  AccountingAccount,
  ExpenseTypeMapping,
  ExpenseTypeMappingFormErrors,
  ExpenseTypeMappingFormValues,
  ReceiptType,
  TaxIndicator,
} from "@type/AccountingAccount";
import { apiRequest } from "@utils/apiClient";

interface ExpenseTypeMappingAdminProps {
  initialMappings?: ExpenseTypeMapping[];
  initialAccounts?: AccountingAccount[];
  initialReceiptTypes?: ReceiptType[];
  initialTaxIndicators?: TaxIndicator[];
  apiEndpoint?: string;
  accountsEndpoint?: string;
  receiptTypesEndpoint?: string;
  taxIndicatorsEndpoint?: string;
  token?: string;
}

type Dialog =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; mapping: ExpenseTypeMapping }
  | { kind: "delete"; mapping: ExpenseTypeMapping };

const SEED_RECEIPT_TYPES: ReceiptType[] = [
  { receipt_type_id: 1, name: "Avión", description: "Vuelos nacionales e internacionales" },
  { receipt_type_id: 2, name: "Hotel", description: "Hospedaje" },
  { receipt_type_id: 3, name: "Alimentos", description: "Comidas y consumos" },
  { receipt_type_id: 4, name: "Transporte terrestre", description: "Taxi, Uber, autobús" },
  { receipt_type_id: 5, name: "Casetas y peaje", description: "Casetas de cuota" },
];

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

const SEED_TAX_INDICATORS: TaxIndicator[] = [
  { tax_indicator_id: 1, org_id: 1, code: "IVA16", name: "IVA 16% acreditable", rate: 0.16 },
  { tax_indicator_id: 2, org_id: 1, code: "IVA08", name: "IVA 8% zona fronteriza", rate: 0.08 },
  { tax_indicator_id: 3, org_id: 1, code: "EXENTO", name: "Exento de IVA", rate: 0 },
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

const emptyForm: ExpenseTypeMappingFormValues = {
  receipt_type_id: null,
  cargo_account_id: null,
  abono_account_id: null,
  tax_indicator_id: null,
};

export default function ExpenseTypeMappingAdmin({
  initialMappings,
  initialAccounts,
  initialReceiptTypes,
  initialTaxIndicators,
  apiEndpoint,
  accountsEndpoint,
  receiptTypesEndpoint,
  taxIndicatorsEndpoint,
  token,
}: ExpenseTypeMappingAdminProps) {
  const [mappings, setMappings] = useState<ExpenseTypeMapping[]>(
    initialMappings ?? SEED_MAPPINGS
  );
  const [accounts, setAccounts] = useState<AccountingAccount[]>(
    initialAccounts ?? SEED_ACCOUNTS
  );
  const [receiptTypes, setReceiptTypes] = useState<ReceiptType[]>(
    initialReceiptTypes ?? SEED_RECEIPT_TYPES
  );
  const [taxIndicators, setTaxIndicators] = useState<TaxIndicator[]>(
    initialTaxIndicators ?? SEED_TAX_INDICATORS
  );
  const [dialog, setDialog] = useState<Dialog>({ kind: "closed" });
  const [form, setForm] = useState<ExpenseTypeMappingFormValues>(emptyForm);
  const [errors, setErrors] = useState<ExpenseTypeMappingFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<
    { message: string; type: "success" | "error" } | null
  >(null);

  useEffect(() => {
    if (!apiEndpoint) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<ExpenseTypeMapping[]>(apiEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!cancelled && Array.isArray(data)) setMappings(data);
      } catch (err) {
        console.warn(
          "[ExpenseTypeMappingAdmin] mappings fetch failed, using seed data",
          err
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiEndpoint, token]);

  useEffect(() => {
    if (!accountsEndpoint) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<AccountingAccount[]>(accountsEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!cancelled && Array.isArray(data)) setAccounts(data);
      } catch (err) {
        console.warn(
          "[ExpenseTypeMappingAdmin] accounts fetch failed, using seed data",
          err
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountsEndpoint, token]);

  useEffect(() => {
    if (!receiptTypesEndpoint) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<ReceiptType[]>(receiptTypesEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!cancelled && Array.isArray(data)) setReceiptTypes(data);
      } catch (err) {
        console.warn(
          "[ExpenseTypeMappingAdmin] receipt types fetch failed, using seed data",
          err
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receiptTypesEndpoint, token]);

  useEffect(() => {
    if (!taxIndicatorsEndpoint) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<TaxIndicator[]>(taxIndicatorsEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!cancelled && Array.isArray(data)) setTaxIndicators(data);
      } catch (err) {
        console.warn(
          "[ExpenseTypeMappingAdmin] tax indicators fetch failed, using seed data",
          err
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taxIndicatorsEndpoint, token]);

  const cargoAccounts = useMemo(
    () => accounts.filter((a) => a.type === "cargo" || a.type === "ambos"),
    [accounts]
  );
  const abonoAccounts = useMemo(
    () => accounts.filter((a) => a.type === "abono" || a.type === "ambos"),
    [accounts]
  );

  const accountById = useCallback(
    (id: number | null) =>
      id == null ? null : accounts.find((a) => a.accounting_account_id === id) ?? null,
    [accounts]
  );

  const receiptTypeById = useCallback(
    (id: number | null) =>
      id == null
        ? null
        : receiptTypes.find((r) => r.receipt_type_id === id) ?? null,
    [receiptTypes]
  );

  const taxById = useCallback(
    (id: number | null) =>
      id == null
        ? null
        : taxIndicators.find((t) => t.tax_indicator_id === id) ?? null,
    [taxIndicators]
  );

  /**
   * ReceiptTypes that have not been mapped yet — used to constrain the
   * dropdown on create so a single ReceiptType cannot be mapped twice.
   */
  const availableReceiptTypes = useMemo(() => {
    const usedIds = new Set(
      mappings
        .filter((m) => m.active !== false)
        .map((m) => m.receipt_type_id)
    );
    return receiptTypes.filter(
      (rt) =>
        !usedIds.has(rt.receipt_type_id) ||
        (dialog.kind === "edit" &&
          dialog.mapping.receipt_type_id === rt.receipt_type_id)
    );
  }, [mappings, receiptTypes, dialog]);

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setDialog({ kind: "create" });
  };

  const openEdit = (mapping: ExpenseTypeMapping) => {
    setForm({
      receipt_type_id: mapping.receipt_type_id,
      cargo_account_id: mapping.cargo_account_id,
      abono_account_id: mapping.abono_account_id,
      tax_indicator_id: mapping.tax_indicator_id,
    });
    setErrors({});
    setDialog({ kind: "edit", mapping });
  };

  const closeDialog = () => {
    setDialog({ kind: "closed" });
    setErrors({});
    setSubmitting(false);
  };

  const validate = useCallback(
    (values: ExpenseTypeMappingFormValues): ExpenseTypeMappingFormErrors => {
      const next: ExpenseTypeMappingFormErrors = {};
      if (values.receipt_type_id == null)
        next.receipt_type_id = "Selecciona un tipo de gasto";
      if (values.cargo_account_id == null)
        next.cargo_account_id = "Selecciona la cuenta de cargo";
      if (values.abono_account_id == null)
        next.abono_account_id = "Selecciona la cuenta de abono";
      if (
        values.cargo_account_id != null &&
        values.abono_account_id != null &&
        values.cargo_account_id === values.abono_account_id
      )
        next.abono_account_id = "La cuenta de abono debe ser distinta del cargo";
      return next;
    },
    []
  );

  const handleSubmit = async () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (dialog.kind === "create") {
        const payload = {
          receipt_type_id: form.receipt_type_id!,
          cargo_account_id: form.cargo_account_id!,
          abono_account_id: form.abono_account_id!,
          tax_indicator_id: form.tax_indicator_id,
        };
        let created: ExpenseTypeMapping | null = null;
        if (apiEndpoint) {
          try {
            created = await apiRequest<ExpenseTypeMapping>(apiEndpoint, {
              method: "POST",
              data: payload,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
          } catch (err) {
            console.warn(
              "[ExpenseTypeMappingAdmin] create failed, using local state",
              err
            );
          }
        }
        const nextId =
          created?.expense_type_mapping_id ??
          mappings.reduce((m, x) => Math.max(m, x.expense_type_mapping_id), 0) +
            1;
        const orgId = created?.org_id ?? mappings[0]?.org_id ?? 1;
        setMappings((prev) => [
          ...prev,
          created ?? {
            expense_type_mapping_id: nextId,
            org_id: orgId,
            ...payload,
          },
        ]);
        setToast({ message: "Mapeo creado", type: "success" });
      } else if (dialog.kind === "edit") {
        const payload = {
          receipt_type_id: form.receipt_type_id!,
          cargo_account_id: form.cargo_account_id!,
          abono_account_id: form.abono_account_id!,
          tax_indicator_id: form.tax_indicator_id,
        };
        if (apiEndpoint) {
          try {
            await apiRequest(
              `${apiEndpoint}/${dialog.mapping.expense_type_mapping_id}`,
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
              "[ExpenseTypeMappingAdmin] update failed, using local state",
              err
            );
          }
        }
        setMappings((prev) =>
          prev.map((m) =>
            m.expense_type_mapping_id === dialog.mapping.expense_type_mapping_id
              ? { ...m, ...payload }
              : m
          )
        );
        setToast({ message: "Mapeo actualizado", type: "success" });
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
    const id = dialog.mapping.expense_type_mapping_id;
    if (apiEndpoint) {
      try {
        await apiRequest(`${apiEndpoint}/${id}`, {
          method: "PUT",
          data: { active: false },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      } catch (err) {
        console.warn(
          "[ExpenseTypeMappingAdmin] delete failed, using local state",
          err
        );
      }
    }
    setMappings((prev) => prev.filter((m) => m.expense_type_mapping_id !== id));
    setToast({ message: "Mapeo eliminado", type: "success" });
    closeDialog();
  };

  const dialogOpen = dialog.kind !== "closed";
  const isFormDialog = dialog.kind === "create" || dialog.kind === "edit";
  const deletingMapping = dialog.kind === "delete" ? dialog.mapping : null;
  const deletingReceipt = deletingMapping
    ? receiptTypeById(deletingMapping.receipt_type_id)
    : null;

  const dialogTitle =
    dialog.kind === "create"
      ? "Nuevo mapeo de gasto"
      : dialog.kind === "edit"
        ? "Editar mapeo de gasto"
        : dialog.kind === "delete"
          ? "Eliminar mapeo"
          : "";

  const deleteMessage = deletingMapping
    ? `¿Confirmas eliminar el mapeo para "${
        deletingReceipt?.name ?? "—"
      }"? El tipo de gasto quedará sin cuenta asignada hasta que crees uno nuevo.`
    : "";

  const noReceiptTypesLeft =
    dialog.kind === "create" && availableReceiptTypes.length === 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {mappings.length}{" "}
          {mappings.length === 1 ? "mapeo registrado" : "mapeos registrados"} ·{" "}
          {receiptTypes.length - mappings.length} sin asignar
        </p>
        <Button
          type="button"
          variant="filled"
          color="primary"
          onClick={openCreate}
          disabled={receiptTypes.length === 0}
        >
          + Nuevo mapeo
        </Button>
      </div>

      <section className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                <th className="px-6 py-3 text-left eyebrow">Tipo de gasto</th>
                <th className="px-6 py-3 text-left eyebrow">Cuenta de cargo</th>
                <th className="px-6 py-3 text-left eyebrow">Cuenta de abono</th>
                <th className="px-6 py-3 text-left eyebrow hidden md:table-cell">
                  Impuesto
                </th>
                <th className="px-6 py-3 text-right eyebrow">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-[var(--color-ink-muted)]"
                  >
                    No hay tipos de gasto mapeados aún.
                  </td>
                </tr>
              ) : (
                mappings.map((mapping, idx) => {
                  const isLast = idx === mappings.length - 1;
                  const receipt = receiptTypeById(mapping.receipt_type_id);
                  const cargo = accountById(mapping.cargo_account_id);
                  const abono = accountById(mapping.abono_account_id);
                  const tax = taxById(mapping.tax_indicator_id);
                  return (
                    <tr
                      key={mapping.expense_type_mapping_id}
                      className={`${
                        !isLast
                          ? "border-b border-[var(--color-neutral-200)]"
                          : ""
                      } hover:bg-[var(--color-surface-secondary)] transition-colors`}
                    >
                      <td className="px-6 py-4 text-sm">
                        <span className="font-medium text-[var(--color-ink)]">
                          {receipt?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink)]">
                        {cargo ? (
                          <span className="inline-flex flex-col">
                            <span className="tabular-nums font-medium">
                              {cargo.account_number}
                            </span>
                            <span className="text-xs text-[var(--color-ink-muted)]">
                              {cargo.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--color-ink-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-ink)]">
                        {abono ? (
                          <span className="inline-flex flex-col">
                            <span className="tabular-nums font-medium">
                              {abono.account_number}
                            </span>
                            <span className="text-xs text-[var(--color-ink-muted)]">
                              {abono.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--color-ink-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm hidden md:table-cell">
                        {tax ? (
                          <span className="status-pill bg-[var(--color-surface-secondary)] text-[var(--color-ink-secondary)]">
                            {tax.code}
                          </span>
                        ) : (
                          <span className="text-[var(--color-ink-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(mapping)}
                            className="text-sm text-primary-500 hover:text-primary-400 transition-colors font-medium cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "delete", mapping })
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
        message={dialog.kind === "delete" ? deleteMessage : ""}
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
            {noReceiptTypesLeft && (
              <div className="border-l-4 border-warning-400 bg-warning-50 p-3 rounded-[var(--radius-md)] text-sm text-warning-500">
                Todos los tipos de gasto ya están mapeados. Edita un mapeo
                existente para cambiar sus cuentas.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Tipo de gasto <span className="text-accent-400">*</span>
              </label>
              <select
                value={form.receipt_type_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    receipt_type_id:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                disabled={dialog.kind === "edit"}
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.receipt_type_id
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                } ${dialog.kind === "edit" ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <option value="">— Selecciona —</option>
                {availableReceiptTypes.map((rt) => (
                  <option key={rt.receipt_type_id} value={rt.receipt_type_id}>
                    {rt.name}
                  </option>
                ))}
              </select>
              {errors.receipt_type_id && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.receipt_type_id}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Cuenta de cargo <span className="text-accent-400">*</span>
              </label>
              <select
                value={form.cargo_account_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cargo_account_id:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.cargo_account_id
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
              >
                <option value="">— Selecciona —</option>
                {cargoAccounts.map((a) => (
                  <option
                    key={a.accounting_account_id}
                    value={a.accounting_account_id}
                  >
                    {a.account_number} · {a.name}
                  </option>
                ))}
              </select>
              {errors.cargo_account_id && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.cargo_account_id}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Cuenta de abono <span className="text-accent-400">*</span>
              </label>
              <select
                value={form.abono_account_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    abono_account_id:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={`w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors ${
                  errors.abono_account_id
                    ? "border-accent-400"
                    : "border-[var(--color-neutral-300)]"
                }`}
              >
                <option value="">— Selecciona —</option>
                {abonoAccounts.map((a) => (
                  <option
                    key={a.accounting_account_id}
                    value={a.accounting_account_id}
                  >
                    {a.account_number} · {a.name}
                  </option>
                ))}
              </select>
              {errors.abono_account_id && (
                <p className="text-accent-400 text-xs mt-1">
                  {errors.abono_account_id}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--color-ink-secondary)]">
                Indicador de impuesto{" "}
                <span className="text-[var(--color-ink-muted)]">(opcional)</span>
              </label>
              <select
                value={form.tax_indicator_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    tax_indicator_id:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="w-full border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors"
              >
                <option value="">— Sin indicador —</option>
                {taxIndicators.map((t) => (
                  <option key={t.tax_indicator_id} value={t.tax_indicator_id}>
                    {t.code} · {t.name}
                  </option>
                ))}
              </select>
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
