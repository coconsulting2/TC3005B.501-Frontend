/**
 * Author: Emiliano Deyta
 *
 * CFDI SAT validation status configuration.
 * Defines the visual tokens for each SAT validation state
 * following the Editorial Finance design system.
 **/
export const SAT_STATUSES = ["vigente", "cancelado", "no_encontrado"] as const;

export type SatStatus = (typeof SAT_STATUSES)[number];

export const SAT_STATUS_LABELS: Record<SatStatus, string> = {
  vigente: "Vigente",
  cancelado: "Cancelado",
  no_encontrado: "No encontrado",
};

export const SAT_STATUS_STYLES: Record<SatStatus, string> = {
  vigente: "bg-[var(--color-success-50)] text-[var(--color-success-500)]",
  cancelado: "bg-[var(--color-error-50)] text-[var(--color-error-400)]",
  no_encontrado: "bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]",
};

export const SAT_STATUS_DOT: Record<SatStatus, string> = {
  vigente: "bg-[var(--color-success-300)]",
  cancelado: "bg-[var(--color-error-300)]",
  no_encontrado: "bg-[var(--color-neutral-400)]",
};

export interface SatValidationResponse {
  status: SatStatus;
  verified_at: string;
}
