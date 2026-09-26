// ============================================================================
// Deterministic Risk Scoring Engine
//
// riskScore = sum of 7 weighted category scores. Each category is capped at
// its weight (config.ts WEIGHT_PROFILES) and can go down to minus half its
// weight when protective factors outweigh risky ones; the total is clamped
// to 0-100. Every point traces to a named factor.
// ============================================================================

import { ApplicantProfile, RiskAssessmentResult, RiskCategoryBreakdown, RiskFactorContribution } from "@insurtechai/shared";
import { WEIGHT_PROFILES, categorizeRiskScore, RiskCategoryKey } from "./config";
import { CATEGORY_BUILDERS } from "./factors";
import { assessFraud } from "./fraudEngine";
import { tr } from "../i18n";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const CATEGORY_KEY_TO_BREAKDOWN: Record<RiskCategoryKey, keyof RiskCategoryBreakdown> = {
  age: "age",
  lifestyle: "lifestyle",
  historicalClaims: "historicalClaims",
  geographic: "geographic",
  asset: "asset",
  behavioral: "behavioral",
  fraud: "fraud",
};

export function assessRisk(applicant: ApplicantProfile): RiskAssessmentResult {
  const profile = WEIGHT_PROFILES[applicant.policy.insuranceType];
  const allFactors: RiskFactorContribution[] = [];
  const breakdown: RiskCategoryBreakdown = {
    age: 0, lifestyle: 0, historicalClaims: 0, geographic: 0, asset: 0, behavioral: 0, fraud: 0,
  };

  for (const key of Object.keys(profile) as RiskCategoryKey[]) {
    const maxPoints = profile[key];
    if (maxPoints === 0) continue;

    let categoryFactors: RiskFactorContribution[];
    if (key === "fraud") {
      // Fraud contributes to the overall risk score too (a small weight),
      // but the full fraud breakdown/signals are reported separately via
      // assessFraud() in the composite response — not duplicated here.
      const fraudResult = assessFraud(applicant);
      const scaled = (fraudResult.fraudScore / 100) * maxPoints;
      categoryFactors = scaled > 0.5
        ? [{
            name: tr("Answers an insurer would check"),
            category: "Fraud",
            impact: Math.round(scaled * 10) / 10,
            direction: "negative",
            description: fraudResult.signals.length === 1
              ? tr("One answer looks unusual next to the others. See \"What an insurer may ask about\".")
              : tr("{n} answers look unusual next to the others. See \"What an insurer may ask about\".", { n: fraudResult.signals.length }),
          }]
        : [];
    } else {
      categoryFactors = CATEGORY_BUILDERS[key](applicant, maxPoints);
    }

    // Protective factors can pull a category below zero (down to half its
    // weight), so a clean record or an anti-theft device genuinely offsets
    // risk elsewhere. Only the final score is clamped to 0-100.
    const categorySum = clamp(
      categoryFactors.reduce((sum, f) => sum + f.impact, 0),
      -maxPoints * 0.5,
      maxPoints,
    );
    breakdown[CATEGORY_KEY_TO_BREAKDOWN[key]] = Math.round(categorySum * 10) / 10;
    allFactors.push(...categoryFactors);
  }

  const rawScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const riskScore = clamp(Math.round(rawScore), 0, 100);

  // Sort factors by absolute impact (largest driver first) for the
  // explainability UI.
  allFactors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    riskScore,
    riskCategory: categorizeRiskScore(riskScore),
    insuranceType: applicant.policy.insuranceType,
    factors: allFactors,
    categoryBreakdown: breakdown,
    rawScore,
  };
}
