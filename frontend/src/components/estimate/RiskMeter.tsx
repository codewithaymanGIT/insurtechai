import { useRef } from "react";
import type { RiskCategory } from "@insurtechai/shared";
import { gsap, useGSAP, reducedMotion } from "../../lib/motion";
import { CountUp } from "../ui/CountUp";
import { RISK_TEXT, cn } from "../../lib/utils";
import { useT } from "../../context/I18nContext";

// Five bands across a 240° arc, with a gap between each.
const START = -210;
const SWEEP = 240;
const BANDS = 5;
const GAP = 3;
const BAND_STROKE = ["stroke-risk-1", "stroke-risk-2", "stroke-risk-3", "stroke-risk-4", "stroke-risk-5"];

const RISK_PHRASE: Record<RiskCategory, string> = {
  "Very Low": "Very low risk",
  Low: "Low risk",
  Moderate: "Moderate risk",
  High: "High risk",
  "Very High": "Very high risk",
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function RiskMeter({ score, category, size = 188, className }: { score: number; category: RiskCategory; size?: number; className?: string }) {
  const root = useRef<SVGSVGElement>(null);
  const t = useT();
  const cx = 100, cy = 100, r = 78;
  const bandSweep = (SWEEP - GAP * (BANDS - 1)) / BANDS;
  const angle = START + (Math.min(100, Math.max(0, score)) / 100) * SWEEP;
  const [nx, ny] = polar(cx, cy, r, angle);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-band]"), { opacity: 0.15, duration: 0.5, stagger: 0.06, ease: "power1.out" });
      gsap.fromTo(q("[data-needle]"), { rotation: -(angle - START), svgOrigin: `${cx} ${cy}` }, { rotation: 0, svgOrigin: `${cx} ${cy}`, duration: 1.2, ease: "expo.out", delay: 0.1 });
    },
    { scope: root, dependencies: [score] },
  );

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size * 0.82 }}>
      <svg ref={root} viewBox="0 0 200 164" className="size-full overflow-visible" role="img" aria-label={t("Risk score {score} out of 100, {category}", { score: Math.round(score), category: t(category) })}>
        {Array.from({ length: BANDS }).map((_, i) => {
          const from = START + i * (bandSweep + GAP);
          const active = score >= (i * 100) / BANDS;
          return (
            <path
              key={i}
              data-band
              d={arc(cx, cy, r, from, from + bandSweep)}
              fill="none"
              strokeWidth={10}
              strokeLinecap="butt"
              className={active ? BAND_STROKE[i] : "stroke-surface-3"}
            />
          );
        })}
        <g data-needle>
          <circle cx={nx} cy={ny} r={8} className="fill-bg stroke-fg" strokeWidth={3} />
        </g>
      </svg>
      <div className="absolute inset-x-0 top-[38%] flex flex-col items-center">
        <CountUp value={score} className="num text-4xl font-semibold tracking-[-0.04em] text-fg" />
        <span className={cn("mt-1 text-xs font-medium", RISK_TEXT[category])}>{RISK_PHRASE[category] ? t(RISK_PHRASE[category]) : `${category.charAt(0) + category.slice(1).toLowerCase()} risk`}</span>
      </div>
    </div>
  );
}
