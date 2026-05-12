/**
 * Author: Emiliano Deyta
 *
 * Description:
 * Formulario de comprobación: CFDI nacional (XML + SAT vía backend) o gasto
 * internacional (imagen JPG/PNG, sin UUID/SAT, conversión FX a MXN).
 **/

import { useState, useCallback, useEffect } from "react";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@utils/apiClient";
import { EXPENSE_TYPES } from "@config/expenseForm";
import type { ParsedXmlData } from "@config/expenseForm";

const API_BASE = (import.meta.env.PUBLIC_API_BASE_URL || "https://localhost:3000/api").replace(
  /\/$/,
  "",
);

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/user/csrf-token`, {
    method: "GET",
    credentials: "include",
  });
  const data = await res.json();
  if (!data?.csrfToken) throw new Error("CSRF ausente");
  return data.csrfToken as string;
}

const expenseSchema = z.object({
  rfc_emisor: z
    .string()
    .min(12, "RFC debe tener al menos 12 caracteres")
    .max(13, "RFC no puede exceder 13 caracteres"),
  fecha_emision: z.string().min(1, "Fecha de emisión es requerida"),
  monto_total: z.coerce.number().positive("El monto debe ser mayor a 0"),
  uuid: z.string().min(1, "UUID es requerido"),
  receipt_type_id: z.coerce.number().min(1, "Selecciona un tipo de gasto"),
  notas: z.string().optional(),
});

const internationalSchema = z.object({
  descripcion: z.string().min(3, "Describe el gasto").max(254),
  fecha_emision: z.string().min(1, "Fecha es requerida"),
  monto_total: z.coerce.number().positive("El monto debe ser mayor a 0"),
  moneda: z.enum(["USD", "EUR", "GBP", "JPY", "CAD"]),
  receipt_type_id: z.coerce.number().min(1, "Selecciona un tipo de gasto"),
  notas: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;
type InternationalFormData = z.infer<typeof internationalSchema>;

interface Props {
  receiptId: number;
  token: string;
  onSuccess?: () => void;
}

export default function XmlExpenseForm({ receiptId, token, onSuccess }: Props) {
  const [isInternational, setIsInternational] = useState(false);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registroSugerido, setRegistroSugerido] = useState<Record<string, unknown> | null>(null);
  const [fxMxn, setFxMxn] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(false);

  const nationalForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseFormData>,
    defaultValues: {
      rfc_emisor: "",
      fecha_emision: "",
      monto_total: 0,
      uuid: "",
      receipt_type_id: 0,
      notas: "",
    },
  });

  const intlForm = useForm<InternationalFormData>({
    resolver: zodResolver(internationalSchema) as Resolver<InternationalFormData>,
    defaultValues: {
      descripcion: "",
      fecha_emision: new Date().toISOString().slice(0, 10),
      monto_total: 0,
      moneda: "USD",
      receipt_type_id: 0,
      notas: "",
    },
  });

  const intlMonto = intlForm.watch("monto_total");
  const intlMoneda = intlForm.watch("moneda");

  useEffect(() => {
    if (!isInternational) {
      setFxMxn(null);
      return;
    }
    const amt = Number(intlMonto);
    if (!intlMoneda || !Number.isFinite(amt) || amt <= 0) {
      setFxMxn(null);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setFxLoading(true);
        try {
          const qs = new URLSearchParams({
            from: intlMoneda,
            to: "MXN",
            amount: String(amt),
          });
          const body = await apiRequest<{ data?: { converted?: number } }>(
            `/fx/convert?${qs.toString()}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const converted = body?.data?.converted;
          setFxMxn(typeof converted === "number" ? converted : null);
        } catch {
          setFxMxn(null);
        } finally {
          setFxLoading(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [isInternational, intlMonto, intlMoneda, token]);

  const handleXmlUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setXmlFile(file);
      setParsing(true);
      setParseError(null);
      setRegistroSugerido(null);

      try {
        const formData = new FormData();
        formData.append("xml", file);
        const csrf = await fetchCsrfToken();
        const res = await fetch(`${API_BASE}/comprobantes/parse-xml`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "csrf-token": csrf,
          },
          body: formData,
          credentials: "include",
        });

        if (!res.ok) throw new Error("Error al procesar el XML");

        const data: ParsedXmlData = await res.json();

        nationalForm.reset({
          rfc_emisor: data.rfc_emisor,
          fecha_emision: data.fecha_emision,
          monto_total: data.monto_total,
          uuid: data.uuid,
          receipt_type_id: 0,
          notas: "",
        });
        setRegistroSugerido((data.registro_sugerido as Record<string, unknown>) ?? null);
      } catch {
        setParseError("No se pudo procesar el archivo XML. Verifica que sea un CFDI válido.");
      } finally {
        setParsing(false);
      }
    },
    [token, nationalForm],
  );

  const onNationalSubmit: SubmitHandler<ExpenseFormData> = async (data) => {
    setSubmitting(true);
    setParseError(null);
    try {
      const fe = new Date(data.fecha_emision);
      if (Number.isNaN(fe.getTime())) {
        setParseError("La fecha de emisión no es válida.");
        setSubmitting(false);
        return;
      }
      const base = registroSugerido ?? {};
      const merged = {
        ...base,
        rfc_emisor: data.rfc_emisor,
        uuid: data.uuid,
        fecha_emision: fe.toISOString(),
        total: data.monto_total,
        subtotal: data.monto_total,
        receipt_type_id: data.receipt_type_id,
        ...(data.notas?.trim() ? { notas: data.notas.trim() } : {}),
      };
      await apiRequest(`/comprobantes/${receiptId}`, {
        method: "POST",
        data: merged,
        headers: { Authorization: `Bearer ${token}` },
      });
      onSuccess?.();
    } catch {
      setParseError("Error al guardar la comprobación. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const onInternationalSubmit: SubmitHandler<InternationalFormData> = async (data) => {
    setSubmitting(true);
    setParseError(null);
    try {
      if (!imageFile) {
        setParseError("Adjunta una imagen JPG o PNG del recibo.");
        setSubmitting(false);
        return;
      }
      const csrf = await fetchCsrfToken();
      const fd = new FormData();
      fd.append("receipt_image", imageFile);
      const up = await fetch(
        `${API_BASE}/files/upload-receipt-files/${receiptId}?isInternational=1`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "csrf-token": csrf,
          },
          body: fd,
          credentials: "include",
        },
      );
      if (!up.ok) {
        const t = await up.text();
        throw new Error(t || "upload");
      }

      const emisionIntl = new Date(`${data.fecha_emision}T12:00:00`);
      if (Number.isNaN(emisionIntl.getTime())) {
        setParseError("La fecha de emisión no es válida.");
        setSubmitting(false);
        return;
      }
      await apiRequest(`/comprobantes/${receiptId}`, {
        method: "POST",
        data: {
          is_international: true,
          descripcion: data.descripcion,
          total: data.monto_total,
          moneda: data.moneda,
          fecha_emision: emisionIntl.toISOString(),
          receipt_type_id: data.receipt_type_id,
          notas: data.notas || undefined,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      onSuccess?.();
    } catch {
      setParseError("Error al guardar el gasto internacional. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    "w-full border rounded-[var(--radius-md)] px-3 py-2.5 text-sm bg-[var(--color-surface-white)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors";

  const readonlyClass =
    "bg-[var(--color-surface-secondary)] text-[var(--color-ink-muted)] cursor-not-allowed";

  return (
    <div className="card-editorial p-6 md:p-8">
      <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink-secondary)] mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={isInternational}
          onChange={(e) => {
            setIsInternational(e.target.checked);
            setParseError(null);
            setXmlFile(null);
            setImageFile(null);
          }}
          className="accent-primary-400"
        />
        Gasto internacional
      </label>

      {!isInternational && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
            Archivo XML del CFDI <span className="text-accent-400">*</span>
          </label>
          <input
            type="file"
            accept=".xml"
            onChange={handleXmlUpload}
            disabled={parsing}
            className="block w-full text-sm text-[var(--color-ink-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-[var(--radius-md)] file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-500 hover:file:bg-primary-200 file:cursor-pointer file:transition-colors"
          />
          {parsing && (
            <p className="text-xs text-[var(--color-ink-muted)] mt-1 animate-pulse">
              Procesando XML...
            </p>
          )}
          {xmlFile && !parsing && !parseError && (
            <p className="text-xs text-success-500 mt-1">{xmlFile.name} cargado correctamente</p>
          )}
        </div>
      )}

      {isInternational && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
            Imagen del recibo (JPG / PNG) <span className="text-accent-400">*</span>
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--color-ink-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-[var(--radius-md)] file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-500 hover:file:bg-primary-200 file:cursor-pointer file:transition-colors"
          />
          {imageFile && (
            <p className="text-xs text-success-500 mt-1">{imageFile.name} seleccionada</p>
          )}
        </div>
      )}

      {parseError && <p className="text-xs text-accent-400 mb-4">{parseError}</p>}

      {!isInternational ? (
        <form onSubmit={nationalForm.handleSubmit(onNationalSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                RFC Emisor
              </label>
              <input
                {...nationalForm.register("rfc_emisor")}
                readOnly
                className={`${inputBase} ${readonlyClass}`}
                placeholder="Se llenará al subir XML"
              />
              {nationalForm.formState.errors.rfc_emisor && (
                <p className="text-xs text-accent-400 mt-1">
                  {nationalForm.formState.errors.rfc_emisor.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                UUID
              </label>
              <input
                {...nationalForm.register("uuid")}
                readOnly
                className={`${inputBase} ${readonlyClass}`}
                placeholder="Se llenará al subir XML"
              />
              {nationalForm.formState.errors.uuid && (
                <p className="text-xs text-accent-400 mt-1">
                  {nationalForm.formState.errors.uuid.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                Fecha de Emisión <span className="text-accent-400">*</span>
              </label>
              <input
                {...nationalForm.register("fecha_emision")}
                type="datetime-local"
                className={`${inputBase} ${nationalForm.formState.errors.fecha_emision ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
              />
              {nationalForm.formState.errors.fecha_emision && (
                <p className="text-xs text-accent-400 mt-1">
                  {nationalForm.formState.errors.fecha_emision.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                Monto Total <span className="text-accent-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-muted)]">
                  $
                </span>
                <input
                  {...nationalForm.register("monto_total")}
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${inputBase} pl-7 ${nationalForm.formState.errors.monto_total ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
                />
              </div>
              {nationalForm.formState.errors.monto_total && (
                <p className="text-xs text-accent-400 mt-1">
                  {nationalForm.formState.errors.monto_total.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Tipo de Gasto <span className="text-accent-400">*</span>
            </label>
            <select
              {...nationalForm.register("receipt_type_id")}
              className={`${inputBase} ${nationalForm.formState.errors.receipt_type_id ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
            >
              <option value={0}>Seleccionar tipo de gasto</option>
              {EXPENSE_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {nationalForm.formState.errors.receipt_type_id && (
              <p className="text-xs text-accent-400 mt-1">
                {nationalForm.formState.errors.receipt_type_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Notas <span className="text-[var(--color-ink-muted)]">(opcional)</span>
            </label>
            <textarea
              {...nationalForm.register("notas")}
              rows={3}
              className={`${inputBase} border-[var(--color-neutral-300)] resize-none`}
              placeholder="Observaciones adicionales..."
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-primary-500 text-white hover:bg-primary-400 active:bg-primary-300 transition-all duration-200 focus:ring-2 focus:ring-primary-200 focus:ring-offset-1 disabled:bg-neutral-300 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              {submitting ? "Guardando..." : "Guardar Comprobación"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={intlForm.handleSubmit(onInternationalSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Descripción del gasto <span className="text-accent-400">*</span>
            </label>
            <input
              {...intlForm.register("descripcion")}
              className={`${inputBase} ${intlForm.formState.errors.descripcion ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
              placeholder="Ej. Hotel London Heathrow"
            />
            {intlForm.formState.errors.descripcion && (
              <p className="text-xs text-accent-400 mt-1">
                {intlForm.formState.errors.descripcion.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                Fecha <span className="text-accent-400">*</span>
              </label>
              <input
                {...intlForm.register("fecha_emision")}
                type="date"
                className={`${inputBase} ${intlForm.formState.errors.fecha_emision ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
              />
              {intlForm.formState.errors.fecha_emision && (
                <p className="text-xs text-accent-400 mt-1">
                  {intlForm.formState.errors.fecha_emision.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
                Moneda <span className="text-accent-400">*</span>
              </label>
              <select
                {...intlForm.register("moneda")}
                className={`${inputBase} border-[var(--color-neutral-300)]`}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Monto <span className="text-accent-400">*</span>
            </label>
            <input
              {...intlForm.register("monto_total")}
              type="number"
              step="0.01"
              min="0"
              className={`${inputBase} ${intlForm.formState.errors.monto_total ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
            />
            {intlForm.formState.errors.monto_total && (
              <p className="text-xs text-accent-400 mt-1">
                {intlForm.formState.errors.monto_total.message}
              </p>
            )}
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              {fxLoading && "Calculando tipo de cambio…"}
              {!fxLoading && fxMxn != null && (
                <>
                  Equivalente aproximado:{" "}
                  <strong>
                    {fxMxn.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                  </strong>
                </>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Tipo de Gasto <span className="text-accent-400">*</span>
            </label>
            <select
              {...intlForm.register("receipt_type_id")}
              className={`${inputBase} ${intlForm.formState.errors.receipt_type_id ? "border-accent-400" : "border-[var(--color-neutral-300)]"}`}
            >
              <option value={0}>Seleccionar tipo de gasto</option>
              {EXPENSE_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {intlForm.formState.errors.receipt_type_id && (
              <p className="text-xs text-accent-400 mt-1">
                {intlForm.formState.errors.receipt_type_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink-secondary)] mb-1.5">
              Notas <span className="text-[var(--color-ink-muted)]">(opcional)</span>
            </label>
            <textarea
              {...intlForm.register("notas")}
              rows={3}
              className={`${inputBase} border-[var(--color-neutral-300)] resize-none`}
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-primary-500 text-white hover:bg-primary-400 active:bg-primary-300 transition-all duration-200 focus:ring-2 focus:ring-primary-200 focus:ring-offset-1 disabled:bg-neutral-300 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              {submitting ? "Guardando..." : "Guardar comprobación internacional"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
