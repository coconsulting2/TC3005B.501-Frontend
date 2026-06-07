/**
 * InfoTooltip — ícono ⓘ con texto de ayuda (hover + clic para móvil).
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";

interface Props {
  text: string;
  /** Etiqueta accesible cuando el tooltip está cerrado */
  label?: string;
}

export default function InfoTooltip({ text, label = "Más información" }: Props) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const rootRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  const close = useCallback(() => {
    setHover(false);
    setPinned(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <span
      ref={rootRef}
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", marginLeft: 6 }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setPinned((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={{
          border: "none",
          background: "transparent",
          cursor: "help",
          padding: 0,
          lineHeight: 1,
          color: "var(--color-ink-muted)",
          display: "inline-flex",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden>
          info
        </span>
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 50,
            left: "50%",
            bottom: "calc(100% + 8px)",
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: 280,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--color-ink)",
            background: "var(--color-surface-white)",
            border: "1px solid var(--color-neutral-300)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,.12)",
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
