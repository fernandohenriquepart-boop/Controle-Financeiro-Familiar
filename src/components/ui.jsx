import { useRef, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";

// UI primitivos, compartilhados entre as abas.
// ---------------------------------------------------------------------------

export const inputClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

export const primaryButtonClass =
  "flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 disabled:opacity-60";

export const secondaryButtonClass =
  "flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50";

export function Badge({ className = "", children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

export function Field({ label, error, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {error && (
        <span className="flex items-center gap-1 text-xs text-rose-600">
          <AlertCircle size={12} /> {error}
        </span>
      )}
    </label>
  );
}

export function Avatar({ name, emoji, size = 28 }) {
  const displayName = name || "?";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-600 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * (emoji ? 0.55 : 0.38) }}
      title={displayName}
    >
      {emoji || initials}
    </span>
  );
}

export function ProgressBar({ pct, barClassName = "bg-emerald-500", trackClassName = "bg-slate-200" }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${trackClassName}`}>
      <div className={`h-full rounded-full transition-[width] ${barClassName}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Modal({ title, isOpen, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-2xl outline-none sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="text-xs text-slate-400">{description}</p>}
    </div>
  );
}

export function Card({ className = "", children }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}
