import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Tone = "neutral" | "accent" | "positive" | "warning" | "danger" | 1 | 2 | 3 | 4 | 5;

const TONE: Record<string, string> = {
  neutral: "text-fg-muted border-border-strong",
  accent: "text-accent-text border-accent/30 bg-accent/10",
  positive: "text-positive border-positive/30 bg-positive/10",
  warning: "text-warning border-warning/30 bg-warning/10",
  danger: "text-danger border-danger/30 bg-danger/10",
  1: "text-risk-1 border-risk-1/30 bg-risk-1/10",
  2: "text-risk-2 border-risk-2/30 bg-risk-2/10",
  3: "text-risk-3 border-risk-3/30 bg-risk-3/10",
  4: "text-risk-4 border-risk-4/30 bg-risk-4/10",
  5: "text-risk-5 border-risk-5/30 bg-risk-5/10",
};
const DOT: Record<string, string> = {
  neutral: "bg-fg-subtle", accent: "bg-accent", positive: "bg-positive", warning: "bg-warning", danger: "bg-danger",
  1: "bg-risk-1", 2: "bg-risk-2", 3: "bg-risk-3", 4: "bg-risk-4", 5: "bg-risk-5",
};

export function Tag({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded border px-1.5 text-2xs font-medium", TONE[String(tone)], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", DOT[String(tone)])} />}
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", DOT[String(tone)], className)} />;
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border-strong bg-surface-2 px-1 font-mono text-[10px] text-fg-subtle", className)}>
      {children}
    </kbd>
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-surface", className)} {...props} />;
}

export function PanelHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-4 py-3", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle", className)}>{children}</p>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-surface-2", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Callout({ tone = "neutral", icon, children, className }: { tone?: "neutral" | "warning" | "danger" | "accent"; icon?: ReactNode; children: ReactNode; className?: string }) {
  const t = {
    neutral: "border-border bg-surface-2/60 text-fg-muted",
    warning: "border-warning/30 bg-warning/[0.07] text-fg",
    danger: "border-danger/30 bg-danger/[0.07] text-fg",
    accent: "border-accent/25 bg-accent/[0.06] text-fg",
  }[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm", t, className)}>
      {icon && <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
