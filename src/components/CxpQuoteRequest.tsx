import { useCallback, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import Toast from "@components/Toast";
import { showAppAlert } from "@utils/appAlert";

interface Props {
  request_id: string;
  requested_fee: number;
  token: string;
  needsPlane?: boolean;
  needsHotel?: boolean;
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  const detail =
    err && typeof err === "object" && "detail" in err
      ? (err as { detail?: { response?: { error?: string } } }).detail
      : undefined;
  if (detail?.response && typeof detail.response.error === "string") {
    return detail.response.error;
  }
  return err instanceof Error ? err.message : fallback;
}

export default function CxpQuoteRequest({
  request_id,
  requested_fee,
  token,
  needsPlane = false,
  needsHotel = false,
}: Props) {
  const [imposedFee, setImposedFee] = useState(
    () => (requested_fee > 0 ? String(requested_fee) : ""),
  );
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );

  const needsAgency = needsPlane || needsHotel;

  const nextStepHint = needsAgency
    ? "Al confirmar, la solicitud pasará a Agencia de viajes para cotizar vuelo y/o hospedaje."
    : "Al confirmar, la solicitud pasará a comprobación de gastos del solicitante (sin paso de agencia).";

  const handleSubmit = useCallback(async () => {
    const amount = Number(imposedFee);
    if (!Number.isFinite(amount) || amount < 0) {
      showAppAlert("Indica un monto aprobado válido (mayor o igual a 0).", { variant: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest(`/accounts-payable/attend-travel-request/${request_id}`, {
        method: "PUT",
        data: { imposed_fee: amount },
        headers: { Authorization: `Bearer ${token}` },
      });
      setToast({ message: "Monto aprobado correctamente.", type: "success" });
      await new Promise((r) => setTimeout(r, 1200));
      window.location.href = "/cotizaciones";
    } catch (err) {
      showAppAlert(getApiErrorMessage(err, "No se pudo registrar el monto aprobado."), {
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [imposedFee, request_id, token]);

  return (
    <div className="w-full min-w-0 card-editorial p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-ink)]">Aprobación de monto</h2>
        <p className="text-sm text-[var(--color-ink-secondary)] mt-1">
          Cuentas por pagar — define el anticipo autorizado para esta solicitud.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-surface-secondary)] p-4 space-y-2 text-sm">
          <p className="text-[var(--color-ink)]">
            <span className="font-medium">Monto solicitado:</span>{" "}
            <span className="money-display text-base">
              ${Number(requested_fee).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </p>
          <p className="text-[var(--color-ink-secondary)] leading-relaxed">{nextStepHint}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-ink-secondary)] mb-1">
            Monto aprobado (MXN)
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={imposedFee}
            onChange={(e) => setImposedFee(e.target.value)}
            className="w-full border border-[var(--color-neutral-300)] rounded-lg px-3 py-2.5 text-sm bg-[var(--color-surface-white)]"
            placeholder="Ej. 30000"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2 border-t border-[var(--color-neutral-200)]">
        <a
          href="/cotizaciones"
          className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </a>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="px-5 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submitting ? "Guardando…" : "Confirmar monto"}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
