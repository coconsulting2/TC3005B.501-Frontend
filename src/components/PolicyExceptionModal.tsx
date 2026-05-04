/**
 * PolicyExceptionModal — captura justificación obligatoria (>=10 chars) y crea
 * la PolicyException PENDING vía POST /api/refunds/exceptions (M2-006 RF-45).
 */
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@components/Button";
import Modal from "@components/Modal";
import { apiRequest } from "@utils/apiClient";

const schema = z.object({
  justification: z.string().trim().min(10, "Mínimo 10 caracteres"),
});
type FormData = z.infer<typeof schema>;

export interface PolicyExceptionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (exception: { exceptionId: number }) => void;
  requestId: number;
  receiptId?: number;
  policyId?: number | null;
  capId?: number | null;
  amountClaimed: number;
  amountAllowed?: number | null;
  excessAmount: number;
}

/**
 * @param {PolicyExceptionModalProps} props
 */
export default function PolicyExceptionModal(props: PolicyExceptionModalProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { justification: "" },
  });

  if (!props.open) return null;

  async function onSubmit(values: FormData) {
    try {
      const created = await apiRequest<{ exceptionId: number }>("/refunds/exceptions", {
        method: "POST",
        data: {
          requestId: props.requestId,
          receiptId: props.receiptId ?? null,
          policyId: props.policyId ?? null,
          capId: props.capId ?? null,
          amountClaimed: props.amountClaimed,
          amountAllowed: props.amountAllowed ?? null,
          excessAmount: props.excessAmount,
          justification: values.justification,
        },
      });
      form.reset();
      props.onCreated?.(created);
      props.onClose();
    } catch (e: any) {
      const detail = e?.detail?.response?.error || "Error al crear excepción.";
      form.setError("justification", { message: detail });
    }
  }

  return (
    <Modal
      title="Justificar excedente de política"
      message={`Este gasto excede la política por $${props.excessAmount.toFixed(2)}. Describe el motivo (mínimo 10 caracteres).`}
      show={props.open}
      onClose={props.onClose}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "grid", gap: "0.75rem" }}>
        <p>Tu aprobador verá esta justificación al revisar.</p>
        <textarea aria-label="Justificación" rows={5} {...form.register("justification")} placeholder="Ejemplo: único hotel disponible cerca del congreso." />
        {form.formState.errors.justification && (
          <small style={{ color: "#B91C1C" }}>{form.formState.errors.justification.message}</small>
        )}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <Button variant="outline" color="primary" onClick={props.onClose}>Cancelar</Button>
          <Button type="submit" variant="filled" color="warning" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Enviando..." : "Enviar justificación"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
