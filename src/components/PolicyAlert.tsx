/**
 * PolicyAlert — banner inline reusable que avisa cuando un gasto excede política (M2-006 RF-44).
 * El llamador decide si pasar onJustify (para abrir el PolicyExceptionModal).
 */
import Button from "@components/Button";

export interface PolicyAlertProps {
  exceeded: boolean;
  capAmount?: number | null;
  capUnit?: string | null;
  currency?: string;
  message?: string;
  onJustify?: () => void;
}

const formatMxn = (n: number, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(n);

const UNIT_LABELS: Record<string, string> = {
  per_night: "por noche",
  per_trip: "por trayecto",
  per_day: "por día",
  per_event: "por evento",
};

/**
 * @param {PolicyAlertProps} props
 */
export default function PolicyAlert(props: PolicyAlertProps) {
  if (!props.exceeded) return null;

  const cap = props.capAmount != null ? formatMxn(Number(props.capAmount), props.currency || "MXN") : null;
  const unit = props.capUnit ? (UNIT_LABELS[props.capUnit] || props.capUnit) : null;

  return (
    <div role="alert" style={alertStyle}>
      <strong>Excede la política de viáticos.</strong>
      <div style={{ marginTop: "0.25rem" }}>
        {props.message || (cap ? `Tope ${cap} ${unit ?? ""}.` : "Revise el tope aplicable.")}
      </div>
      {props.onJustify && (
        <div style={{ marginTop: "0.5rem" }}>
          <Button variant="filled" color="accent" size="small" onClick={props.onJustify}>
            Justificar y enviar de todos modos
          </Button>
        </div>
      )}
    </div>
  );
}

const alertStyle: React.CSSProperties = {
  background: "#FEF3C7",
  border: "1px solid #F59E0B",
  borderRadius: "0.375rem",
  padding: "0.75rem 1rem",
  color: "#7C2D12",
  marginBlock: "0.75rem",
};
