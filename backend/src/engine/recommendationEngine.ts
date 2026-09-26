// ============================================================================
// Premium Optimizer — tries every applicable lever (levers.ts), re-runs the
// real risk + premium engines on the modified profile, and ranks the
// resulting savings by impact-per-effort. Nothing here is a canned string:
// every number is a genuine re-simulation.
// ============================================================================

import { ApplicantProfile, Recommendation } from "@insurtechai/shared";
import { LEVERS } from "./levers";
import { normaliseMotor } from "./motorValue";
import { tr } from "../i18n";
import { assessRisk } from "./riskEngine";
import { assessFraud } from "./fraudEngine";
import { calculatePremium } from "./premiumEngine";

const EFFORT_WEIGHT: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

export function generateRecommendations(applicant: ApplicantProfile, currentPremium: number): Recommendation[] {
  const results: Recommendation[] = [];

  for (const lever of LEVERS) {
    if (!lever.appliesTo(applicant)) continue;

    const modified = normaliseMotor(lever.apply(applicant));
    const risk = assessRisk(modified);
    const fraud = assessFraud(modified);
    const premium = calculatePremium(modified, risk, fraud);

    const saving = currentPremium - premium.finalPremium;
    if (saving <= 0) continue; // only surface levers that genuinely help

    const savingPercent = Math.round((saving / currentPremium) * 1000) / 10;
    const effortWeight = EFFORT_WEIGHT[lever.effort];

    results.push({
      id: lever.id,
      title: tr(lever.title),
      description: typeof lever.description === "function" ? lever.description(applicant) : tr(lever.description),
      category: lever.category,
      estimatedSavingAmount: Math.round(saving),
      estimatedSavingPercent: savingPercent,
      effort: lever.effort,
      impactPerEffort: Math.round((saving / effortWeight) * 100) / 100,
    });
  }

  return results.sort((a, b) => b.impactPerEffort - a.impactPerEffort);
}
