import { cn } from "../../lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M8 21a8 8 0 0 1 16 0" fill="none" className="stroke-accent-fg" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 21l4.6-5.4" className="stroke-accent-fg" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="21" r="2.2" className="fill-accent-fg" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-fg">InsurTechAI</span>
    </span>
  );
}
