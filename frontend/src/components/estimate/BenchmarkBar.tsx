import { useRef } from "react";
import type { MarketBenchmark } from "@insurtechai/shared";
import { gsap, useGSAP, reducedMotion } from "../../lib/motion";
import { cn, inr } from "../../lib/utils";
import { useT } from "../../context/I18nContext";

const POSITION_TEXT: Record<string, { label: string; cls: string }> = {
  below: { label: "Below the usual range", cls: "text-positive" },
  within: { label: "Within the usual range", cls: "text-fg" },
  above: { label: "Above the usual range", cls: "text-warning" },
};

/** Your estimate plotted against the published market range for similar cover. */
export function BenchmarkBar({ benchmark, premium, compact }: { benchmark: MarketBenchmark; premium: number; compact?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const t = useT();
  const { lowInr: low, highInr: high, medianInr: median } = benchmark;

  const valid = benchmark.applicable && low != null && high != null;
  const span = valid ? high! - low! : 1;
  const min = valid ? Math.max(0, Math.min(low! - span * 0.45, premium - span * 0.15)) : 0;
  const max = valid ? Math.max(high! + span * 0.45, premium + span * 0.15) : 1;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  useGSAP(
    () => {
      if (!valid || reducedMotion()) return;
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-range]"), { scaleX: 0, transformOrigin: "left center", duration: 0.8, ease: "power3.inOut" });
      gsap.from(q("[data-marker]"), { left: "0%", opacity: 0, duration: 1.1, ease: "expo.out", delay: 0.25 });
    },
    { scope: root, dependencies: [premium, low, high] },
  );

  if (!valid) {
    return <p className="text-sm text-fg-muted">{benchmark.basis}</p>;
  }

  const pos = POSITION_TEXT[benchmark.position];
  return (
    <div ref={root}>
      {!compact && pos && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className={cn("text-sm font-medium", pos.cls)}>{t(pos.label)}</p>
          <p className="num text-xs text-fg-subtle">
            {t("Typical {low} – {high}", { low: inr(low!), high: inr(high!) })}
          </p>
        </div>
      )}
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
        <div
          data-range
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-fg-subtle/60"
          style={{ left: `${pct(low!)}%`, width: `${pct(high!) - pct(low!)}%` }}
        />
        {median != null && <div className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-fg-muted" style={{ left: `${pct(median)}%` }} />}
        <div data-marker className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${Math.min(98, Math.max(2, pct(premium)))}%` }}>
          <div className="size-3.5 rounded-full border-[3px] border-bg bg-accent shadow-[0_0_0_1px_hsl(var(--accent))]" />
        </div>
      </div>
      <div className="relative mt-1 h-4 text-2xs text-fg-subtle">
        <span className="num absolute -translate-x-1/2" style={{ left: `${pct(low!)}%` }}>{inr(low!)}</span>
        {median != null && !compact && <span className="absolute -translate-x-1/2 max-sm:hidden" style={{ left: `${pct(median)}%` }}>{t("median")}</span>}
        <span className="num absolute -translate-x-1/2" style={{ left: `${pct(high!)}%` }}>{inr(high!)}</span>
      </div>
    </div>
  );
}
