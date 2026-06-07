/**
 * Panel de simulación de reglas de workflow (preview en vivo).
 */
import { useCallback, useEffect, useState } from "react";
import { previewWorkflowRules } from "@utils/workflowRulePreview";
import type {
  WorkflowRuleFormData,
  WorkflowRulePreviewResponse,
  WfRuleType,
} from "@type/WorkflowRuleTypes";

const T = {
  ink: "var(--color-ink)",
  inkSecondary: "var(--color-ink-secondary)",
  inkMuted: "var(--color-ink-muted)",
  surface: "var(--color-surface-white)",
  surfaceMuted: "var(--color-surface-secondary)",
  border: "var(--color-neutral-300)",
  borderSoft: "var(--color-neutral-200)",
  primary: "var(--color-primary-500)",
  primarySoft: "var(--color-primary-50)",
  primaryBorder: "var(--color-primary-200)",
  warning: "var(--color-warning-700)",
  warningBg: "var(--color-warning-50)",
  warningBorder: "var(--color-warning-200)",
  error: "var(--color-error-500)",
} as const;

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export interface WorkflowRulePreviewPanelProps {
  headers?: Record<string, string>;
  /** Monto inicial */
  defaultAmount?: number;
  ruleType?: WfRuleType;
  departmentId?: number | null;
  /** Si se pasa, simula el borrador del modal */
  draftRule?: WorkflowRuleFormData | null;
  editingRuleId?: string | null;
  compact?: boolean;
  /** Dispara refetch cuando cambia (ej. hash del form) */
  refreshKey?: string | number;
  showAdvanced?: boolean;
}

export default function WorkflowRulePreviewPanel({
  headers,
  defaultAmount = 10000,
  ruleType = "pre",
  departmentId = null,
  draftRule = null,
  editingRuleId = null,
  compact = false,
  refreshKey,
  showAdvanced = false,
}: WorkflowRulePreviewPanelProps) {
  const [amount, setAmount] = useState(defaultAmount);
  const [currency, setCurrency] = useState("MXN");
  const [orgLevel, setOrgLevel] = useState<string>("");
  const [result, setResult] = useState<WorkflowRulePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(showAdvanced);

  const runPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await previewWorkflowRules(
        {
          amount: Number(amount) || 0,
          ruleType,
          departmentId,
          currency: currency.trim() || "MXN",
          orgLevel: orgLevel.trim() ? Number(orgLevel) : null,
          ...(draftRule ? { draftRule, editingRuleId: editingRuleId ?? undefined } : {}),
        },
        headers,
      );
      setResult(res);
    } catch (e: unknown) {
      setResult(null);
      setError(e instanceof Error ? e.message : "No se pudo simular.");
    } finally {
      setLoading(false);
    }
  }, [amount, ruleType, departmentId, currency, orgLevel, draftRule, editingRuleId, headers]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runPreview();
    }, compact ? 400 : 0);
    return () => window.clearTimeout(t);
  }, [runPreview, refreshKey, compact]);

  const levelChips = result?.levels ?? [];

  return (
    <div
      style={{
        padding: compact ? "12px 14px" : "16px 18px",
        borderRadius: 10,
        border: `1px solid ${T.primaryBorder}`,
        background: T.primarySoft,
      }}
    >
      <p style={{ margin: "0 0 10px", fontSize: compact ? 13 : 14, fontWeight: 600, color: T.ink }}>
        {compact ? "Vista previa del efecto" : "Simular monto"}
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 12,
        }}
      >
        <label style={{ fontSize: 12, color: T.inkSecondary }}>
          Monto (MXN)
          <input
            type="number"
            min={0}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{
              display: "block",
              marginTop: 4,
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              fontSize: 14,
              width: 140,
              background: T.surface,
            }}
          />
        </label>
        {!compact ? (
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: T.primary,
              color: T.surface,
              fontWeight: 600,
              fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Simulando…" : "Simular"}
          </button>
        ) : null}
      </div>

      {!compact ? (
        <details
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
          style={{ marginBottom: 12, fontSize: 12, color: T.inkSecondary }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 600, color: T.ink }}>
            Más parámetros (moneda, nivel org.)
          </summary>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            <label>
              Moneda
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                style={{
                  display: "block",
                  marginTop: 4,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  width: 72,
                }}
              />
            </label>
            <label>
              Nivel org.
              <input
                type="number"
                min={1}
                value={orgLevel}
                onChange={(e) => setOrgLevel(e.target.value)}
                placeholder="Opcional"
                style={{
                  display: "block",
                  marginTop: 4,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  width: 100,
                }}
              />
            </label>
          </div>
        </details>
      ) : null}

      {error ? (
        <p style={{ margin: 0, fontSize: 12, color: T.error }} role="alert">
          {error}
        </p>
      ) : null}

      {loading && !result ? (
        <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>Calculando ruta…</p>
      ) : null}

      {result ? (
        <div style={{ fontSize: 13, color: T.inkSecondary, lineHeight: 1.5 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {levelChips.map((l) => (
              <span
                key={l}
                style={{
                  padding: "4px 10px",
                  borderRadius: 12,
                  background: T.surface,
                  border: `1px solid ${T.borderSoft}`,
                  fontWeight: 600,
                  fontSize: 12,
                  color: T.ink,
                }}
              >
                N{l}
              </span>
            ))}
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 12,
                background: T.surface,
                fontSize: 12,
              }}
            >
              Inicio: {result.initialStatusLabel}
            </span>
          </div>
          <p style={{ margin: "0 0 8px", color: T.ink }}>{result.summary}</p>
          {result.hints.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
              {result.hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
          {draftRule?.skipIfBelow != null && Number(amount) < Number(draftRule.skipIfBelow) ? (
            <p
              style={{
                margin: "10px 0 0",
                padding: "8px 10px",
                borderRadius: 6,
                background: T.warningBg,
                border: `1px solid ${T.warningBorder}`,
                color: T.warning,
                fontSize: 12,
              }}
            >
              Montos por debajo de {MXN.format(Number(draftRule.skipIfBelow))} empezarán en N
              {draftRule.approvalLevel}, sin pasar por niveles inferiores.
            </p>
          ) : null}
        </div>
      ) : null}

      {!compact ? (
        <p style={{ margin: "12px 0 0", fontSize: 11, color: T.inkMuted }}>
          Usa todas las reglas activas del mismo tipo (pre/post) y departamento.{" "}
          <a href="/admin/workflow-simulator" style={{ color: T.primary }}>
            Simulador completo
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** Montos de ejemplo para la guía rápida */
export const GUIDE_SAMPLE_AMOUNTS = [10000, 50000, 85000] as const;
