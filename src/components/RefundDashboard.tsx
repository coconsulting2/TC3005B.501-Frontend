/**
 * RefundDashboard — núcleo del panel /reembolso (M2-006).
 *   Reemplaza la data mock con GET /api/refunds/by-user/:userId.
 *   Muestra saldo, historial de reembolsos por solicitud y banner de plazo si aplica.
 *   Devolución de dinero efectiva (US-06 criterio 3) queda fuera de scope: pertenece a F-028 (wallet).
 */
import { useEffect, useState } from "react";
import { apiRequest } from "@utils/apiClient";

interface HistoryRow {
  requestId: number;
  date: string;
  amount: number;
  status: number;
  tripEndDate: string | null;
  notes: string | null;
  receiptCount: number;
}

interface DashboardData {
  balance: number;
  history: HistoryRow[];
  pendingDeadlineWarning: string | null;
}

interface Props {
  userId: number;
  initialData?: DashboardData | null;
}

const formatMxn = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const STATUS_LABEL: Record<number, string> = {
  1: "Borrador", 2: "Primera Revisión", 3: "Segunda Revisión",
  4: "Cotización", 5: "Atención AV", 6: "Comprobación", 7: "Validación",
  8: "Finalizado", 9: "Cancelado", 10: "Rechazado",
};

/**
 * @param {Props} props
 */
export default function RefundDashboard(props: Props) {
  const [data, setData] = useState<DashboardData | null>(props.initialData ?? null);
  const [loading, setLoading] = useState(!props.initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.initialData) return;
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await apiRequest<DashboardData>(`/refunds/by-user/${props.userId}`);
      setData(r);
      setError(null);
    } catch (e: any) {
      setError(e?.detail?.response?.error || "Error al cargar reembolsos.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>Cargando…</p>;
  if (error) return <p style={{ color: "#B91C1C" }}>{error}</p>;
  if (!data) return <p>Sin datos.</p>;

  const totalAprobado = data.history.reduce((acc, h) => acc + h.amount, 0);

  return (
    <div>
      {data.pendingDeadlineWarning && (
        <div role="alert" style={warning}>
          ⚠️ {data.pendingDeadlineWarning} Comunícate con el administrador si necesitas extender el plazo.
        </div>
      )}

      <section style={metricsRow}>
        <MetricBox label="Saldo en wallet" value={formatMxn(data.balance)} />
        <MetricBox label="Total reembolsos aprobados" value={formatMxn(totalAprobado)} />
        <MetricBox label="Solicitudes con comprobantes" value={String(data.history.length)} />
      </section>

      <h2 style={{ marginTop: "2rem" }}>Historial por solicitud</h2>
      {data.history.length === 0 ? (
        <p style={{ color: "var(--color-ink-muted, #6B7280)" }}>Sin reembolsos previos.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Solicitud</th>
              <th style={th}>Creada</th>
              <th style={th}>Fin de viaje</th>
              <th style={th}>Estado</th>
              <th style={th}>Comprobantes</th>
              <th style={th}>Monto reembolsable</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((h) => (
              <tr key={h.requestId}>
                <td style={td}><a href={`/comprobar-solicitud/${h.requestId}`}>#{h.requestId}</a></td>
                <td style={td}>{h.date?.slice(0, 10) || "—"}</td>
                <td style={td}>{h.tripEndDate ? h.tripEndDate.slice(0, 10) : "—"}</td>
                <td style={td}>{STATUS_LABEL[h.status] || h.status}</td>
                <td style={td}>{h.receiptCount}</td>
                <td style={td}>{formatMxn(h.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: "1.5rem", color: "var(--color-ink-muted, #6B7280)", fontSize: "0.875rem" }}>
        Nota: la transferencia efectiva del dinero al empleado se gestiona desde Cuentas por Pagar (módulo F-028 wallet).
      </p>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#6B7280" }}>{label}</div>
      <div style={{ fontSize: "1.75rem", fontFamily: "serif", marginTop: "0.5rem" }}>{value}</div>
    </div>
  );
}

const metricsRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginTop: "1.5rem" };
const metricCardStyle: React.CSSProperties = { background: "var(--color-surface-secondary, #F8F8F4)", border: "1px solid #E5E5DD", borderRadius: "0.5rem", padding: "1rem" };
const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };
const td: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #eee" };
const warning: React.CSSProperties = { background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "0.375rem", padding: "0.75rem 1rem", color: "#7C2D12", marginBlock: "1rem" };
