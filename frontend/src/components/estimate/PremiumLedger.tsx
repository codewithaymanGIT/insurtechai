import { useRef } from "react";
import type { ApplicantProfile, PremiumBreakdown } from "@insurtechai/shared";
import { gsap, useGSAP, reducedMotion } from "../../lib/motion";
import { COVER_LABEL, cn, inr } from "../../lib/utils";
import { useT } from "../../context/I18nContext";

type TFn = ReturnType<typeof useT>;

interface Row {
  label: string;
  note: string;
  op: "base" | "×" | "+";
  value: string;
  running: number;
  tone?: "up" | "down";
}

function rowsFor(p: PremiumBreakdown, a: ApplicantProfile, t: TFn): Row[] {
  const rows: Row[] = [];
  let running = p.basePremium;
  const baseNote: Record<string, string> = {
    MOTOR: t("Own-damage cover, priced as a share of your vehicle's IDV"),
    HEALTH: a.personal.dependents >= 2 ? t("Family floater base rate for your age") : t("Individual base rate for your age"),
    LIFE: t("Published term rates for your age, scaled to your cover and term"),
    PROPERTY: t("Base rate on the property value"),
  };
  rows.push({ label: t("Base price"), note: baseNote[a.policy.insuranceType], op: "base", value: inr(p.basePremium), running });

  const mult = (label: string, note: string, m: number) => {
    running *= m;
    rows.push({ label, note, op: "×", value: m.toFixed(2), running, tone: m > 1.001 ? "up" : m < 0.999 ? "down" : undefined });
  };
  mult(t("Risk"), p.riskMultiplier < 1 ? t("Protective factors outweigh the risky ones") : t("From your risk score"), p.riskMultiplier);
  mult(t("Cover level"), t(COVER_LABEL[a.policy.coverageLevel]), p.coverageMultiplier);
  mult(t("City"), a.personal.location, p.locationFactor);
  mult(
    t("Claim history"),
    p.claimHistoryFactor < 1 ? t("No-claim discount") : p.claimHistoryFactor > 1.001 ? t("Recent claims") : a.motor ? t("No recent claims. The no-claim bonus is applied separately.") : t("No recent claims"),
    p.claimHistoryFactor,
  );
  mult(t("Deductible"), a.policy.deductible > 0 ? t("{amount} voluntary", { amount: inr(a.policy.deductible) }) : t("None"), p.deductibleFactor);
  if (Math.abs(p.fraudAdjustment - 1) > 0.001) mult(t("Consistency check"), t("Unusual answers an insurer would verify"), p.fraudAdjustment);
  if (a.motor && (p.ncbPercent ?? 0) > 0) {
    mult(
      t("No-claim bonus"),
      t("{pct}% off own damage for {n} claim-free years", { pct: p.ncbPercent, n: Math.min(5, a.motor.claimFreeYears ?? 0) }),
      1 - p.ncbPercent / 100,
    );
  }

  if (p.fixedPremium > 0) {
    running += p.fixedPremium;
    rows.push({ label: t("Third-party cover"), note: t("Fixed by IRDAI by engine size. Same at every insurer."), op: "+", value: inr(p.fixedPremium), running });
  }
  return rows;
}

/** The premium formula as a ledger, each step with its running total. */
export function PremiumLedger({ premium, applicant }: { premium: PremiumBreakdown; applicant: ApplicantProfile }) {
  const root = useRef<HTMLDivElement>(null);
  const t = useT();
  const rows = rowsFor(premium, applicant, t);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-row]"), { opacity: 0, x: -6, duration: 0.4, stagger: 0.05, ease: "power2.out", delay: 0.15 });
      gsap.from(q("[data-total]"), { opacity: 0, duration: 0.5, delay: 0.15 + rows.length * 0.05 });
    },
    { scope: root, dependencies: [premium.finalPremium] },
  );

  return (
    <div ref={root} className="text-sm">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-border px-4 py-2 text-2xs font-medium text-fg-subtle sm:grid-cols-[1fr_72px_96px]">
        <span>{t("Step")}</span>
        <span className="text-right">{t("Factor")}</span>
        <span className="text-right">{t("Running total")}</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} data-row className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-border/60 px-4 py-2.5 sm:grid-cols-[1fr_72px_96px]">
          <div className="min-w-0">
            <p className="text-fg">{r.label}</p>
            <p className="truncate text-2xs text-fg-subtle">{r.note}</p>
          </div>
          <p
            className={cn(
              "num text-right font-mono text-xs",
              r.tone === "up" ? "text-warning" : r.tone === "down" ? "text-positive" : "text-fg-muted",
            )}
          >
            {r.op === "base" ? "" : r.op === "×" ? `× ${r.value}` : `+ ${r.value}`}
          </p>
          <p className="num text-right text-fg-muted">{inr(r.running)}</p>
        </div>
      ))}
      <div data-total className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3">
        <div>
          <p className="font-medium text-fg">{t("Estimated premium")}</p>
          <p className="text-2xs text-fg-subtle">{t("Per year, rounded, before 18% GST")}</p>
        </div>
        <p className="num text-right text-md font-semibold text-fg">{inr(premium.finalPremium)}</p>
      </div>
    </div>
  );
}
