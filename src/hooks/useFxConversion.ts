import { useEffect, useState } from "react";
import { apiRequest } from "@utils/apiClient";

export interface FxConversionData {
  from: string;
  to: string;
  amount: number;
  rate: number;
  converted: number;
  rateDate: string;
  fromCache: boolean;
}

export interface UseFxConversionOptions {
  from: string;
  to?: string;
  amount: number;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseFxConversionResult {
  data: FxConversionData | null;
  loading: boolean;
  error: string;
}

/**
 * Consulta GET /api/fx/convert (Frankfurter/ECB) con debounce.
 */
export function useFxConversion({
  from,
  to = "MXN",
  amount,
  enabled = true,
  debounceMs = 400,
}: UseFxConversionOptions): UseFxConversionResult {
  const [data, setData] = useState<FxConversionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !from || from.length !== 3) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    if (from.toUpperCase() === to.toUpperCase()) {
      setData({
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        amount,
        rate: 1,
        converted: amount,
        rateDate: new Date().toISOString().slice(0, 10),
        fromCache: false,
      });
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const qs = new URLSearchParams({
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            amount: String(amount),
          });
          const body = await apiRequest<{ success?: boolean; data?: FxConversionData }>(
            `/fx/convert?${qs.toString()}`,
          );
          if (cancelled) return;
          if (body?.data && typeof body.data.rate === "number") {
            setData(body.data);
          } else {
            setData(null);
            setError("No se pudo interpretar la respuesta del tipo de cambio.");
          }
        } catch (err) {
          if (cancelled) return;
          setData(null);
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo obtener el tipo de cambio.",
          );
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [from, to, amount, enabled, debounceMs]);

  return { data, loading, error };
}
