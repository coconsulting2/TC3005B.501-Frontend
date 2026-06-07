/**
 * Panel de simulación de reglas de workflow (preview en vivo).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { previewWorkflowRules } from "@utils/workflowRulePreview";
import { WORKFLOW_CURRENCY_OPTIONS } from "@config/workflowRuleFieldHelp";
import type {
  WorkflowRuleFormData,
  WorkflowRulePreviewResponse,
  WfParamType,
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
  success: "var(--color-success-600)",
  successBg: "var(--color-success-50)",
  successBorder: "var(--color-success-200)",
} as const;

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export interface CountryOption {
  countryId: number;
  countryName: string;
}

export interface ReceiptTypeOption {
  receiptTypeId: number;
  receiptTypeName: string;
}

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
  countries?: CountryOption[];
  receiptTypes?: ReceiptTypeOption[];
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${T.border}`,
  fontSize: 14,
  background: T.surface,
  color: T.ink,
};

function resolveParamType(draftRule: WorkflowRuleFormData | null | undefined): WfParamType {
  return draftRule?.paramType ?? "importe";
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
  countries = [],
  receiptTypes = [],
}: WorkflowRulePreviewPanelProps) {
  const paramType = resolveParamType(draftRule);

  const [amount, setAmount] = useState(defaultAmount);
  const [currency, setCurrency] = useState("MXN");
  const [destinationCountryId, setDestinationCountryId] = useState<string>("");
  const [receiptTypeId, setReceiptTypeId] = useState<string>("");
  const [orgLevel, setOrgLevel] = useState<string>("1");
  const [result, setResult] = useState<WorkflowRulePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(showAdvanced);

  useEffect(() => {
    if (paramType === "destino" && !destinationCountryId && countries.length > 0) {
      const mexico = countries.find((c) => c.countryName === "México");
      setDestinationCountryId(String(mexico?.countryId ?? countries[0].countryId));
    }
  }, [paramType, countries, destinationCountryId]);

  useEffect(() => {
    if (paramType === "gasto" && !receiptTypeId && receiptTypes.length > 0) {
      setReceiptTypeId(String(receiptTypes[0].receiptTypeId));
    }
  }, [paramType, receiptTypes, receiptTypeId]);

  useEffect(() => {
    if (paramType === "moneda" && draftRule?.paramValue) {
      setCurrency(String(draftRule.paramValue).toUpperCase());
    }
  }, [paramType, draftRule?.paramValue]);

  useEffect(() => {
    if (paramType === "nivel" && draftRule?.paramValue) {
      setOrgLevel(String(draftRule.paramValue));
    }
  }, [paramType, draftRule?.paramValue]);

  const draftRuleMatches = useMemo(() => {
    if (!draftRule?.paramValue) return null;
    const pv = String(draftRule.paramValue).trim();
    switch (paramType) {
      case "destino":
        return String(destinationCountryId) === pv;
      case "moneda":
        return currency.toUpperCase() === pv.toUpperCase();
      case "nivel":
        return String(orgLevel) === pv;
      case "gasto":
        return String(receiptTypeId) === pv;
      default:
        return null;
    }
  }, [draftRule, paramType, destinationCountryId, currency, orgLevel, receiptTypeId]);

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
          destinationCountryIds: destinationCountryId ? [Number(destinationCountryId)] : [],
          receiptTypeIds: receiptTypeId ? [Number(receiptTypeId)] : [],
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
  }, [
    amount,
    ruleType,
    departmentId,
    currency,
    destinationCountryId,
    receiptTypeId,
    orgLevel,
    draftRule,
    editingRuleId,
    headers,
  ]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runPreview();
    }, compact ? 400 : 0);
    return () => window.clearTimeout(t);
  }, [runPreview, refreshKey, compact]);

  const levelChips = result?.levels ?? [];
  const showApprovalRoute =
    paramType === "importe" || draftRuleMatches === true;

  const primaryInput = (() => {
    switch (paramType) {
      case "destino":
        return (
          <label style={{ fontSize: 12, color: T.inkSecondary }}>
            País de destino
            <select
              value={destinationCountryId}
              onChange={(e) => setDestinationCountryId(e.target.value)}
              style={{ ...inputStyle, minWidth: 220 }}
            >
              <option value="">— Selecciona —</option>
              {countries.map((c) => (
                <option key={c.countryId} value={c.countryId}>
                  {c.countryName}
                </option>
              ))}
            </select>
          </label>
        );
      case "moneda":
        return (
          <label style={{ fontSize: 12, color: T.inkSecondary }}>
            Moneda del anticipo
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{ ...inputStyle, width: 120 }}
            >
              {WORKFLOW_CURRENCY_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
        );
      case "nivel":
        return (
          <label style={{ fontSize: 12, color: T.inkSecondary }}>
            Nivel org. del solicitante
            <input
              type="number"
              min={1}
              max={10}
              value={orgLevel}
              onChange={(e) => setOrgLevel(e.target.value)}
              style={{ ...inputStyle, width: 100 }}
            />
          </label>
        );
      case "gasto":
        return (
          <label style={{ fontSize: 12, color: T.inkSecondary }}>
            Tipo de comprobante
            <select
              value={receiptTypeId}
              onChange={(e) => setReceiptTypeId(e.target.value)}
              style={{ ...inputStyle, minWidth: 220 }}
            >
              <option value="">— Selecciona —</option>
              {receiptTypes.map((rt) => (
                <option key={rt.receiptTypeId} value={rt.receiptTypeId}>
                  {rt.receiptTypeName}
                </option>
              ))}
            </select>
          </label>
        );
      default:
        return (
          <label style={{ fontSize: 12, color: T.inkSecondary }}>
            Monto del anticipo (MXN)
            <input
              type="number"
              min={0}
              step={100}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ ...inputStyle, width: 140 }}
            />
          </label>
        );
    }
  })();

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
        {compact ? "Vista previa del efecto" : "Simular escenario"}
      </p>
      {compact && paramType !== "importe" ? (
        <p style={{ margin: "0 0 10px", fontSize: 11, color: T.inkMuted, lineHeight: 1.45 }}>
          Simula solo esta regla según su parámetro. No incluye umbral ni skip de reglas de importe
          de la organización.
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 12,
        }}
      >
        {primaryInput}
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

      {draftRuleMatches !== null ? (
        <p
          style={{
            margin: "0 0 10px",
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            color: draftRuleMatches ? T.success : T.warning,
            background: draftRuleMatches ? T.successBg : T.warningBg,
            border: `1px solid ${draftRuleMatches ? T.successBorder : T.warningBorder}`,
          }}
        >
          {draftRuleMatches
            ? "La regla que estás configurando aplica con este escenario simulado."
            : "La regla que estás configurando no aplica con este escenario (ajusta el valor o la simulación)."}
        </p>
      ) : null}

      {!compact ? (
        <details
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
          style={{ marginBottom: 12, fontSize: 12, color: T.inkSecondary }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 600, color: T.ink }}>
            Más parámetros del escenario
          </summary>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {paramType === "importe" ? (
              <label>
                Monto (MXN)
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  style={{ ...inputStyle, width: 120 }}
                />
              </label>
            ) : null}
            {paramType !== "moneda" ? (
              <label>
                Moneda
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{ ...inputStyle, width: 88 }}
                >
                  {WORKFLOW_CURRENCY_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {paramType !== "destino" ? (
              <label>
                País destino
                <select
                  value={destinationCountryId}
                  onChange={(e) => setDestinationCountryId(e.target.value)}
                  style={{ ...inputStyle, minWidth: 160 }}
                >
                  <option value="">— Ninguno —</option>
                  {countries.map((c) => (
                    <option key={c.countryId} value={c.countryId}>
                      {c.countryName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {paramType !== "gasto" ? (
              <label>
                Tipo gasto
                <select
                  value={receiptTypeId}
                  onChange={(e) => setReceiptTypeId(e.target.value)}
                  style={{ ...inputStyle, minWidth: 140 }}
                >
                  <option value="">— Ninguno —</option>
                  {receiptTypes.map((rt) => (
                    <option key={rt.receiptTypeId} value={rt.receiptTypeId}>
                      {rt.receiptTypeName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {paramType !== "nivel" ? (
              <label>
                Nivel org.
                <input
                  type="number"
                  min={1}
                  value={orgLevel}
                  onChange={(e) => setOrgLevel(e.target.value)}
                  placeholder="Opcional"
                  style={{ ...inputStyle, width: 88 }}
                />
              </label>
            ) : null}
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
          {showApprovalRoute ? (
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
          ) : null}
          <p style={{ margin: "0 0 8px", color: T.ink }}>{result.summary}</p>
          {result.hints.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
              {result.hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
          {draftRule?.skipIfBelow != null &&
          paramType === "importe" &&
          Number(amount) < Number(draftRule.skipIfBelow) ? (
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
