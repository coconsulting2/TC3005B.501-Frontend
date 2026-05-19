/**
 * @file SolicitudTimeline.tsx
 * @description Stepper horizontal del recorrido de la solicitud (completado, actual y pendiente).
 *              GET /api/solicitudes/:id/historial
 */

import { useEffect, useState } from "react";
import { apiRequest } from "@utils/apiClient";

type StepState =
  | "completed"
  | "current"
  | "pending"
  | "skipped"
  | "failed"
  | "cancelled";

interface JourneyStep {
  key: string;
  statusId: number;
  label: string;
  state: StepState;
  timestamp: string | null;
  actor: string | null;
  note: string | null;
}

interface TimelineEvent {
  action: string;
  user: string;
  role: string;
  timestamp: string;
  comment: string | null;
}

interface JourneyResponse {
  currentStatusId: number;
  currentStatusLabel: string;
  steps: JourneyStep[];
  events: TimelineEvent[];
}

interface Props {
  requestId: number;
}

const ACTION_LABEL: Record<string, string> = {
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  ESCALADO: "Escalado",
  REASIGNADO: "Reasignado",
};

const STEP_VISUAL: Record<
  StepState,
  { dot: string; ring: string; label: string; connector: string }
> = {
  completed: {
    dot: "bg-success-500",
    ring: "border-success-500 bg-success-50",
    label: "text-[var(--color-ink)]",
    connector: "bg-success-400",
  },
  current: {
    dot: "bg-primary-500",
    ring: "border-primary-500 bg-primary-50",
    label: "text-[var(--color-ink)] font-medium",
    connector: "bg-[var(--color-neutral-200)]",
  },
  pending: {
    dot: "bg-[var(--color-neutral-300)]",
    ring: "border-[var(--color-neutral-300)] bg-[var(--color-surface-secondary)]",
    label: "text-[var(--color-ink-muted)]",
    connector: "bg-[var(--color-neutral-200)]",
  },
  skipped: {
    dot: "bg-[var(--color-ink-muted)]",
    ring: "border-[var(--color-neutral-300)] bg-[var(--color-surface-secondary)]",
    label: "text-[var(--color-ink-muted)]",
    connector: "bg-[var(--color-neutral-200)]",
  },
  failed: {
    dot: "bg-danger-500",
    ring: "border-danger-500 bg-danger-50",
    label: "text-danger-600 font-medium",
    connector: "bg-[var(--color-neutral-200)]",
  },
  cancelled: {
    dot: "bg-[var(--color-neutral-300)]",
    ring: "border-[var(--color-neutral-200)] bg-[var(--color-surface-secondary)]",
    label: "text-[var(--color-ink-muted)] line-through",
    connector: "bg-[var(--color-neutral-200)]",
  },
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stateCaption(state: StepState): string | null {
  switch (state) {
    case "completed":
      return "Completado";
    case "current":
      return "En curso";
    case "pending":
      return "Pendiente";
    case "failed":
      return "Detenido aquí";
    case "cancelled":
      return "No aplica";
    default:
      return null;
  }
}

export default function SolicitudTimeline({ requestId }: Props) {
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<JourneyResponse>(`/solicitudes/${requestId}/historial`)
      .then((data) => {
        if (!cancelled) setJourney(data);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el historial.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const steps = journey?.steps ?? [];
  const events = journey?.events ?? [];

  return (
    <section className="card-editorial p-5 sm:p-6 mt-8">
      <header className="mb-4">
        <p className="eyebrow">Historial</p>
        <h2
          className="font-editorial text-xl font-normal mt-1"
          style={{ color: "var(--color-ink)" }}
        >
          Línea de tiempo
        </h2>
        {journey?.currentStatusLabel && (
          <p className="text-sm mt-1" style={{ color: "var(--color-ink-muted)" }}>
            Estado actual:{" "}
            <span className="font-medium" style={{ color: "var(--color-ink)" }}>
              {journey.currentStatusLabel}
            </span>
          </p>
        )}
      </header>

      {loading && (
        <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
          Cargando recorrido…
        </p>
      )}

      {!loading && error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!loading && !error && steps.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
          Esta solicitud aún no tiene movimientos registrados.
        </p>
      )}

      {!loading && !error && steps.length > 0 && (
        <>
          <div
            className="overflow-x-auto pb-2 -mx-1 px-1"
            role="list"
            aria-label="Recorrido de la solicitud"
          >
            <ol className="flex items-start min-w-max gap-0">
              {steps.map((step, idx) => {
                const visual = STEP_VISUAL[step.state] ?? STEP_VISUAL.pending;
                const isLast = idx === steps.length - 1;
                const caption = stateCaption(step.state);

                return (
                  <li
                    key={step.key}
                    role="listitem"
                    className="flex items-start flex-1 min-w-[7.5rem] max-w-[11rem]"
                    aria-current={step.state === "current" ? "step" : undefined}
                  >
                    <div className="flex flex-col items-center text-center w-full px-1">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${visual.ring}`}
                        aria-hidden="true"
                      >
                        <span className={`block h-2.5 w-2.5 rounded-full ${visual.dot}`} />
                      </div>
                      <p
                        className={`mt-2 text-xs leading-snug ${visual.label}`}
                      >
                        {step.label}
                      </p>
                      {caption && (
                        <p className="text-[10px] uppercase tracking-wide mt-0.5 text-[var(--color-ink-muted)]">
                          {caption}
                        </p>
                      )}
                      {step.timestamp && (
                        <p className="text-[10px] tabular-nums mt-1 text-[var(--color-ink-muted)]">
                          {formatTimestamp(step.timestamp)}
                        </p>
                      )}
                      {step.actor && (
                        <p className="text-[10px] mt-0.5 text-[var(--color-ink-muted)] truncate max-w-full">
                          {step.actor}
                        </p>
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className="hidden sm:flex flex-1 items-center self-[1.125rem] min-w-[1.5rem] mx-0.5"
                        aria-hidden="true"
                      >
                        <span
                          className={`block h-0.5 w-full rounded-full ${visual.connector}`}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {events.length > 0 && (
            <details className="mt-6 border-t border-[var(--color-neutral-200)] pt-4">
              <summary className="text-sm cursor-pointer text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]">
                Ver movimientos registrados ({events.length})
              </summary>
              <ol className="mt-3 space-y-3 pl-1">
                {events.map((entry, idx) => (
                  <li
                    key={`${entry.timestamp}-${idx}`}
                    className="text-sm border-l-2 border-[var(--color-neutral-300)] pl-3"
                  >
                    <p className="font-medium text-[var(--color-ink)]">
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)] tabular-nums">
                      {formatTimestamp(entry.timestamp)}
                      {entry.user ? ` · ${entry.user}` : ""}
                      {entry.role ? ` (${entry.role})` : ""}
                    </p>
                    {entry.comment && (
                      <p className="text-sm text-[var(--color-ink-secondary)] mt-1">
                        {entry.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}
