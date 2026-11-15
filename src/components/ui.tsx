"use client";
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { DisplayStatus } from "@/lib/tasks/reconcile";
import { STATUS_LABEL } from "@/lib/tasks/reconcile";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold" | "onCardinal";
const variants: Record<Variant, string> = {
  primary: "bg-cardinal text-white hover:bg-cardinal-ink border border-cardinal font-semibold",
  secondary: "bg-card text-ink border border-line-strong hover:border-ink",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-line/50",
  danger: "bg-card text-cardinal border border-cardinal/40 hover:bg-cardinal-wash",
  /** USC gold — the main action on a cardinal surface. */
  gold: "bg-gold text-cardinal-deep border border-gold hover:bg-gold-soft font-bold",
  /** Outline button for cardinal surfaces. */
  onCardinal: "bg-transparent text-white border border-white/70 hover:bg-white/10 font-semibold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }>(
  function Button({ variant = "secondary", size = "md", className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "px-2.5 py-1 text-sm" : "px-4 py-2 text-sm",
          variants[variant],
          className,
        )}
        {...rest}
      />
    );
  },
);

export function LinkButton({ href, children, variant = "secondary", className, download }: { href: string; children: ReactNode; variant?: Variant; className?: string; download?: boolean }) {
  return (
    <a href={href} download={download} className={cx("inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors", variants[variant], className)}>
      {children}
    </a>
  );
}

const STATUS_STYLE: Record<DisplayStatus, string> = {
  completed: "bg-green-wash text-green border-green/30",
  in_progress: "bg-blue-wash text-blue border-blue/30",
  needs_recheck: "bg-amber-wash text-amber border-amber/40",
  needs_confirmation: "bg-blue-wash text-blue border-blue/30",
  missing_info: "bg-cardinal-wash text-cardinal-ink border-cardinal/30",
  todo: "bg-card text-ink border-line-strong",
  not_applicable: "bg-paper text-muted border-line",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={cx("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "cardinal" | "amber" | "blue" | "green" | "gold" }) {
  const t = {
    gold: "bg-gold-wash text-cardinal-deep border-gold",
    neutral: "bg-paper text-muted border-line",
    cardinal: "bg-cardinal-wash text-cardinal-ink border-cardinal/30",
    amber: "bg-amber-wash text-amber border-amber/30",
    blue: "bg-blue-wash text-blue border-blue/30",
    green: "bg-green-wash text-green border-green/30",
  }[tone];
  return <span className={cx("inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", t)}>{children}</span>;
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-xl border border-line bg-card p-4 sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <CardTitle>{title}</CardTitle>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Card heading with the USC gold bar. */
export function CardTitle({ children, as: As = "h2", className }: { children: ReactNode; as?: "h2" | "h3"; className?: string }) {
  return (
    <As className={cx("flex items-center gap-2.5 font-display text-xl font-bold leading-tight", className)}>
      <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gold" />
      <span>{children}</span>
    </As>
  );
}

/** Small uppercase label used above headings ("eyebrow"). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-xs font-bold uppercase tracking-[0.14em] break-words", className ?? "text-cardinal")}>{children}</p>;
}

/** Full-width cardinal band at the top of a page: eyebrow, Caslon title, optional subtitle and actions. */
export function PageBand({ eyebrow, title, subtitle, actions, children }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="on-cardinal bg-cardinal text-white">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-9 sm:px-6 sm:pt-10 sm:pb-11">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            {eyebrow && <Eyebrow className="text-gold">{eyebrow}</Eyebrow>}
            <h1 className="mt-2 font-display text-4xl leading-[1.08] sm:text-5xl">{title}</h1>
            {subtitle && <p className="mt-3 max-w-2xl text-base text-white/85 sm:text-lg">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Month/day block used for dates in lists (cardinal with gold month). */
export function DateChip({ month, day, muted, size = "md" }: { month: string; day: string; muted?: boolean; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 flex-col items-center justify-center rounded-lg leading-none",
        size === "sm" ? "h-11 w-11" : "h-14 w-14",
        muted ? "bg-[#f1eadf] text-muted" : "bg-cardinal text-white",
      )}
    >
      <span className={cx("text-[10px] font-bold uppercase tracking-wide", muted ? "text-muted" : "text-gold")}>{month}</span>
      <span className={cx("font-display font-bold", size === "sm" ? "text-lg" : "text-2xl")}>{day}</span>
    </span>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "error" | "success"; title?: ReactNode; children?: ReactNode }) {
  const t = {
    info: "border-blue/30 bg-blue-wash text-ink",
    warning: "border-amber/40 bg-amber-wash text-ink",
    error: "border-cardinal/40 bg-cardinal-wash text-ink",
    success: "border-green/30 bg-green-wash text-ink",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-md border px-3 py-2 text-sm", t)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
    </div>
  );
}

type FieldProps = { label: string; hint?: ReactNode; error?: string | null; className?: string };

export function TextField({ label, hint, error, className, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={hint || error ? `${id}-d` : undefined}
        className={cx("w-full rounded-md border bg-white px-3 py-2 text-base sm:text-sm", error ? "border-cardinal" : "border-line-strong")}
        {...rest}
      />
      {(hint || error) && (
        <p id={`${id}-d`} className={cx("mt-1 text-xs", error ? "text-cardinal" : "text-muted")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function TextArea({ label, hint, error, className, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint || error ? `${id}-d` : undefined}
        className={cx("w-full rounded-md border bg-white px-3 py-2 text-base sm:text-sm", error ? "border-cardinal" : "border-line-strong")}
        {...rest}
      />
      {(hint || error) && (
        <p id={`${id}-d`} className={cx("mt-1 text-xs", error ? "text-cardinal" : "text-muted")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
  className,
  ...rest
}: FieldProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & { value: T; onChange: (v: T) => void; options: Record<T, string> }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-describedby={hint ? `${id}-d` : undefined}
        className={cx("w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm", value === "unknown" && "text-amber")}
        {...rest}
      >
        {(Object.keys(options) as T[]).map((k) => (
          <option key={k} value={k}>
            {options[k]}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-d`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
