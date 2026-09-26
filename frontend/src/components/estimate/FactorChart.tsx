import { useRef } from "react";
import type { RiskFactorContribution } from "@insurtechai/shared";
import { gsap, useGSAP, reducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";
import { useT } from "../../context/I18nContext";

/** Diverging bars: factors that add risk extend right, ones that reduce it extend left. */
export function FactorChart({ factors }: { factors: RiskFactorContribution[] }) {
  const root = useRef<HTMLUListElement>(null);
  const t = useT();
  const sorted = [...factors].sort((a, b) => b.impact - a.impact);
  const maxAbs = Math.max(1, ...sorted.map((f) => Math.abs(f.impact)));

  useGSAP(
    () => {
      if (reducedMotion()) return;
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-bar]"), { scaleX: 0, duration: 0.7, stagger: 0.04, ease: "power3.out", delay: 0.1 });
    },
    { scope: root, dependencies: [factors.length, maxAbs] },
  );

  if (sorted.length === 0) return <p className="px-4 py-6 text-sm text-fg-muted">{t("Nothing in your answers moves the score noticeably.")}</p>;

  return (
    <ul ref={root} className="divide-y divide-border/60">
      {sorted.map((f) => {
        const up = f.impact > 0;
        const w = (Math.abs(f.impact) / maxAbs) * 100;
        return (
          <li key={f.name} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
            <div className="min-w-0">
              <p className="text-sm text-fg">{f.name}</p>
              <p className="mt-0.5 text-xs text-fg-subtle text-pretty">{f.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative h-2 flex-1">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
                <div
                  data-bar
                  className={cn("absolute inset-y-0 rounded-sm", up ? "left-1/2 bg-warning/80" : "right-1/2 bg-positive/80")}
                  style={{ width: `${w / 2}%`, transformOrigin: up ? "left center" : "right center" }}
                />
              </div>
              <span className={cn("num w-12 text-right font-mono text-xs", up ? "text-warning" : "text-positive")}>
                {up ? "+" : "−"}
                {Math.abs(f.impact).toFixed(1)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
