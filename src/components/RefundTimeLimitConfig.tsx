/**
 * RefundTimeLimitConfig — formulario único para configurar plazo de comprobación (M2-006 RF-37).
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@components/Button";
import Toast from "@components/Toast";
import { apiRequest } from "@utils/apiClient";

const schema = z.object({
  daysAfterTrip: z.coerce.number().int().min(1).max(365),
  graceDays: z.coerce.number().int().min(0).max(30),
  blockOnExpiry: z.boolean(),
});
type FormData = z.infer<typeof schema>;

/**
 * @param {{ token?: string }} _props
 */
export default function RefundTimeLimitConfig(_props: { token?: string }) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { daysAfterTrip: 14, graceDays: 0, blockOnExpiry: true },
  });

  useEffect(() => {
    apiRequest<FormData>("/refunds/time-limit")
      .then((r) => form.reset({
        daysAfterTrip: r.daysAfterTrip ?? 14,
        graceDays: r.graceDays ?? 0,
        blockOnExpiry: r.blockOnExpiry ?? true,
      }))
      .catch(() => setToast({ message: "Error al cargar configuración.", type: "error" }))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(values: FormData) {
    try {
      await apiRequest("/refunds/time-limit", { method: "PUT", data: values });
      setToast({ message: "Configuración actualizada.", type: "success" });
    } catch (e: any) {
      setToast({ message: e?.detail?.response?.error || "Error al guardar.", type: "error" });
    }
  }

  if (loading) return <p>Cargando…</p>;

  return (
    <div>
      <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: "1rem", maxWidth: "30rem" }}>
        <label>
          Días después del fin de viaje
          <input type="number" min={1} max={365} {...form.register("daysAfterTrip")} />
          {form.formState.errors.daysAfterTrip && <small>{form.formState.errors.daysAfterTrip.message}</small>}
        </label>
        <label>
          Días de gracia adicionales
          <input type="number" min={0} max={30} {...form.register("graceDays")} />
          {form.formState.errors.graceDays && <small>{form.formState.errors.graceDays.message}</small>}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" {...form.register("blockOnExpiry")} />
          Bloquear automáticamente al vencer plazo
        </label>
        <Button type="submit" variant="filled" color="primary">Guardar configuración</Button>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
