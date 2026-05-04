/**
 * PolicyExceptionsInbox — sub-componente de bandeja para que aprobadores N1/N2
 * resuelvan excepciones de política (M2-006 RF-45). Lista PENDING y permite
 * aprobar / rechazar con nota.
 */
import { useEffect, useState } from "react";
import Button from "@components/Button";
import Toast from "@components/Toast";
import Modal from "@components/Modal";
import { apiRequest } from "@utils/apiClient";

interface PolicyExceptionRow {
  exceptionId: number;
  requestId: number;
  receiptId: number | null;
  amountClaimed: string | number;
  excessAmount: string | number;
  justification: string;
  status: string;
  createdAt: string;
  receipt?: { receiptId: number; amount: string | number; receiptType?: { receiptTypeName: string } };
  request?: { requestId: number; userId: number };
}

const formatMxn = (n: number, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(n);

/**
 * @param {{ token?: string }} _props
 */
export default function PolicyExceptionsInbox(_props: { token?: string }) {
  const [items, setItems] = useState<PolicyExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [decisionFor, setDecisionFor] = useState<{ id: number; decision: "APPROVED" | "REJECTED" } | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await apiRequest<{ exceptions: PolicyExceptionRow[] }>("/refunds/exceptions/pending");
      setItems(r.exceptions || []);
    } catch (e: any) {
      setToast({ message: e?.detail?.response?.error || "Error al cargar excepciones.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function decide() {
    if (!decisionFor) return;
    try {
      await apiRequest(`/refunds/exceptions/${decisionFor.id}/decide`, {
        method: "POST",
        data: { decision: decisionFor.decision, decisionNote: note || null },
      });
      setToast({
        message: `Excepción ${decisionFor.decision === "APPROVED" ? "aprobada" : "rechazada"}.`,
        type: "success",
      });
      setDecisionFor(null);
      setNote("");
      void load();
    } catch (e: any) {
      setToast({ message: e?.detail?.response?.error || "Error al decidir.", type: "error" });
    }
  }

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ marginBottom: "0.75rem" }}>Excepciones de política pendientes</h2>
      {loading ? (
        <p>Cargando…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--color-ink-muted, #6B7280)" }}>No hay excepciones pendientes.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Solicitud</th>
              <th style={th}>Receipt</th>
              <th style={th}>Monto / Exceso</th>
              <th style={th}>Justificación</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((ex) => (
              <tr key={ex.exceptionId}>
                <td style={td}>#{ex.requestId}</td>
                <td style={td}>
                  {ex.receipt?.receiptType?.receiptTypeName || "—"} (#{ex.receiptId ?? "—"})
                </td>
                <td style={td}>
                  {formatMxn(Number(ex.amountClaimed))}
                  <br />
                  <small style={{ color: "#B91C1C" }}>+{formatMxn(Number(ex.excessAmount))}</small>
                </td>
                <td style={td} title={ex.justification}>
                  {ex.justification.length > 80 ? ex.justification.slice(0, 80) + "…" : ex.justification}
                </td>
                <td style={td}>
                  <Button variant="filled" color="primary" size="small" onClick={() => setDecisionFor({ id: ex.exceptionId, decision: "APPROVED" })}>
                    Aprobar
                  </Button>{" "}
                  <Button variant="border" color="accent" size="small" onClick={() => setDecisionFor({ id: ex.exceptionId, decision: "REJECTED" })}>
                    Rechazar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {decisionFor && (
        <Modal
          title={decisionFor.decision === "APPROVED" ? "Aprobar excepción" : "Rechazar excepción"}
          message={`¿Confirmar ${decisionFor.decision === "APPROVED" ? "aprobación" : "rechazo"} de la excepción #${decisionFor.id}?`}
          show={true}
          onClose={() => setDecisionFor(null)}
        >
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p>
              ¿Confirmar {decisionFor.decision === "APPROVED" ? "aprobación" : "rechazo"} de la excepción #{decisionFor.id}?
              {decisionFor.decision === "APPROVED"
                ? " El receipt quedará marcado como reembolsable."
                : " El receipt no será reembolsado."}
            </p>
            <label>
              Nota (opcional)
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <Button variant="border" color="primary" onClick={() => setDecisionFor(null)}>Cancelar</Button>
              <Button variant="filled" color={decisionFor.decision === "APPROVED" ? "primary" : "accent"} onClick={decide}>
                Confirmar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </section>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };
const td: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #eee", verticalAlign: "top" };
