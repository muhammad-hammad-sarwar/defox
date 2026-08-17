import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "accent" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-500 disabled:bg-primary-900",
  accent: "bg-accent-600 text-white hover:bg-accent-500 disabled:bg-accent-900",
  ghost:
    "border border-surface-border bg-surface-raised text-slate-200 hover:border-slate-600 disabled:text-slate-500",
  danger:
    "border border-red-900/60 bg-transparent text-red-300 hover:bg-red-950/40 disabled:text-red-900",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-surface-border bg-surface-raised p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "border-red-900/60 bg-red-950/40 text-red-200",
    success: "border-primary-900/60 bg-primary-950/40 text-primary-200",
    info: "border-accent-900/60 bg-accent-950/30 text-accent-200",
  } as const;

  return (
    <div role="status" className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-primary-500" />
      {label}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "accent";
}) {
  const tones = {
    neutral: "border-surface-border text-slate-400",
    primary: "border-primary-800 text-primary-300",
    accent: "border-accent-800 text-accent-300",
  } as const;

  return (
    <span className={`rounded border px-1.5 py-0.5 text-xs ${tones[tone]}`}>{children}</span>
  );
}
