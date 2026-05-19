/**
 * @file SolicitudTimeline.tsx
 * @description Read-only chronological timeline of state changes for a request.
 *              Fetches GET /api/solicitudes/:id/historial on mount.
 */

import { useEffect, useState } from "react";
import { apiRequest } from "@utils/apiClient";

interface TimelineEntry {
  action: string;
  user: string;
  role: string;
  timestamp: string;
  comment: string | null;
}

interface Props {
  requestId: number;
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  CREADO:    { label: "Solicitud creada",  color: "bg-blue-500" },
  APROBADO:  { label: "Aprobado",          color: "bg-green-500" },
  RECHAZADO: { label: "Rechazado",         color: "bg-red-500" },
  ESCALADO:  { label: "Escalado",          color: "bg-amber-500" },
  REASIGNADO:{ label: "Reasignado",        color: "bg-purple-500" },
};

function formatTimestamp(iso: string): string {
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

export default function SolicitudTimeline({ requestId }: Props) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<TimelineEntry[]>(`/solicitudes/${requestId}/historial`)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el historial.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [requestId]);

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
      </header>

      {loading && (
        <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
          Cargando historial…
        </p>
      )}

      {!loading && error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
          Esta solicitud aún no tiene movimientos registrados.
        </p>
      )}

      {!loading && !error && entries.length > 0 && (
        <ol
          className="relative pl-5 space-y-4"
          style={{ borderLeft: "1px solid var(--color-neutral-200, #e5e7eb)" }}
        >
          {entries.map((entry, idx) => {
            const meta = ACTION_META[entry.action] ?? { label: entry.action, color: "bg-gray-400" };
            return (
              <li key={idx} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[27px] top-2 w-2.5 h-2.5 rounded-full ${meta.color}`}
                />
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {meta.label}
                  </p>
                  <p
                    className="text-xs tabular-nums"
                    style={{ color: "var(--color-ink-muted)" }}
                  >
                    {formatTimestamp(entry.timestamp)}
                  </p>
                </div>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--color-ink-muted)" }}
                >
                  {entry.user}
                  {entry.role ? ` · ${entry.role}` : ""}
                </p>
                {entry.comment && (
                  <p
                    className="text-sm mt-1 pl-3"
                    style={{
                      color: "var(--color-ink-secondary)",
                      borderLeft: "2px solid var(--color-neutral-300, #d1d5db)",
                    }}
                  >
                    {entry.comment}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
