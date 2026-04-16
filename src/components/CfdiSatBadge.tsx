/**
 * Author: Emiliano Deyta
 *
 * Description:
 * Displays the CFDI validation status against the SAT with a color-coded
 * badge, the last verification timestamp, and a manual re-verify button.
 * Calls GET /comprobantes/:id/validacion-sat.
 **/

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@utils/apiClient";
import {
  SAT_STATUS_LABELS,
  SAT_STATUS_STYLES,
  SAT_STATUS_DOT,
} from "@config/cfdiValidation";
import type { SatStatus, SatValidationResponse } from "@config/cfdiValidation";

interface Props {
  receiptId: number;
  token: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CfdiSatBadge({ receiptId, token }: Props) {
  const [status, setStatus] = useState<SatStatus | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchValidation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SatValidationResponse>(
        `/comprobantes/${receiptId}/validacion-sat`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setStatus(data.status);
      setVerifiedAt(data.verified_at);
    } catch {
      setError("No se pudo verificar el estatus");
    } finally {
      setLoading(false);
    }
  }, [receiptId, token]);

  useEffect(() => {
    fetchValidation();
  }, [fetchValidation]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <span className="w-3 h-3 rounded-full bg-[var(--color-neutral-200)]" />
        <span className="h-4 w-24 rounded bg-[var(--color-neutral-200)]" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <span className="status-pill bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]">
          Sin datos
        </span>
        <button
          onClick={fetchValidation}
          className="text-xs text-[var(--color-primary-300)] hover:text-[var(--color-primary-400)] transition-colors underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Status badge */}
      <span
        className={`status-pill ${SAT_STATUS_STYLES[status]} inline-flex items-center gap-1.5`}
      >
        <span
          className={`w-2 h-2 rounded-full ${SAT_STATUS_DOT[status]}`}
        />
        {SAT_STATUS_LABELS[status]}
      </span>

      {/* Verification date */}
      {verifiedAt && (
        <span className="text-xs text-[var(--color-ink-muted)]">
          Verificado: {formatDate(verifiedAt)}
        </span>
      )}

      {/* Re-verify button */}
      <button
        onClick={fetchValidation}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-300)] hover:text-[var(--color-primary-400)] active:text-[var(--color-primary-500)] transition-colors disabled:opacity-50"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Verificar
      </button>
    </div>
  );
}
