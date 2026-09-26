// ============================================================================
// Dynamic Premium Engine
//
// finalPremium = basePremium × riskMultiplier × coverageMultiplier ×
//                locationFactor × claimHistoryFactor × fraudAdjustment ×
//                deductibleFactor
//
//                × (1 - no-claim bonus, motor only)
//              + fixedPremium (motor third-party, set by IRDAI, not risk-rated)
//
// Every factor is returned in the breakdown so the UI can show exactly how
// the number was produced. Base rates are calibrated against the published
// ranges in marketBenchmark.ts; they are estimates, not any insurer's filed
// rates.
// ============================================================================

import { ApplicantProfile, PremiumBreakdown, RiskAssessmentResult, FraudAssessmentResult } from "@insurtechai/shared";
import { getLocationProfile } from "./config";
import { neutralTermRatePerCrore } from "./marketBenchmark";
import { ncbFor } from "./motorValue";
import { tr } from "../i18n";

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Own-damage premium as a share of the vehicle's IDV. Insurers file their own
// OD rates; these are calibrated so that a typical low-risk profile lands near
// the middle of the published market ranges in marketBenchmark.ts.
// Rates are before the no-claim bonus, which is applied separately using
// IRDAI's slabs (0-50%), so a typical driver with a few claim-free years
// lands in the middle of the published ranges.
const MOTOR_OD_RATE: Record<string, number> = {
  TWO_WHEELER: 0.028, HATCHBACK: 0.022, SEDAN: 0.022, SUV: 0.022, COMMERCIAL: 0.026,
};

/** IRDAI third-party (liability) premiums, annual, before GST. Unchanged
 * since the 2019-20 notification; a revision was proposed for FY2026-27 but
 * had not been notified as of April 2026. Sources: Insure24 and ACKO rate
 * tables (see Methodology page). Commercial vehicles use separate, higher
 * class-based rates; the private-car rate is used as a floor for them. */
function thirdPartyPremium(vehicleType: string, cc: number): number {
  if (vehicleType === "TWO_WHEELER") {
    if (cc <= 75) return 538;
    if (cc <= 150) return 714;
    if (cc <= 350) return 1366;
    return 2804;
  }
  if (cc <= 1000) return 2094;
  if (cc <= 1500) return 3416;
  return 7897;
}

function computeBasePremium(a: ApplicantProfile): number {
  switch (a.policy.insuranceType) {
    case "HEALTH": {
      // Two or more dependents is treated as a family floater, which is also
      // how the market benchmark is chosen.
      const members = a.personal.dependents >= 2 ? Math.min(a.personal.dependents, 4) : 0;
      return 9000 * healthAgeCurve(a.personal.age) * (1 + 0.25 * members);
    }
    case "MOTOR":
      if (!a.motor) throw new Error("Motor profile required for MOTOR premium calculation");
      return a.motor.vehicleValue * (MOTOR_OD_RATE[a.motor.vehicleType] ?? 0.015);
    case "PROPERTY":
      if (!a.property) throw new Error("Property profile required for PROPERTY premium calculation");
      return a.property.propertyValue * 0.0008;
    case "LIFE": {
      if (!a.life) throw new Error("Life profile required for LIFE premium calculation");
      // Published per-crore term rates by age (gender-neutral average), scaled
      // to the cover amount; longer terms cost more per year.
      const perCrore = neutralTermRatePerCrore(a.personal.age);
      const base = perCrore * (a.life.coverageAmount / 10_000_000) * (0.8 + 0.01 * a.life.policyTermYears);
      // Insurers typically load smokers 40-60% for identical cover.
      return a.life.smoker ? base * 1.5 : base;
    }
  }
}

// Relative individual health premium by age (age 25 = 1.0). Indian health
// premiums roughly quadruple between 30 and 60; shape chosen so senior and
// individual profiles land inside the published ranges in marketBenchmark.ts.
const HEALTH_AGE_CURVE: [number, number][] = [
  [18, 0.95], [25, 1.0], [30, 1.15], [35, 1.35], [40, 1.6], [45, 2.0], [50, 2.5], [55, 3.2], [60, 4.2], [65, 5.2], [70, 6.3], [80, 7.5],
];
function healthAgeCurve(age: number): number {
  const c = HEALTH_AGE_CURVE;
  if (age <= c[0][0]) return c[0][1];
  for (let i = 0; i < c.length - 1; i++) {
    const [a0, v0] = c[i], [a1, v1] = c[i + 1];
    if (age <= a1) return v0 + ((v1 - v0) * (age - a0)) / (a1 - a0);
  }
  return c[c.length - 1][1];
}

function computeFixedPremium(a: ApplicantProfile): { amount: number; label: string | null } {
  if (a.policy.insuranceType === "MOTOR" && a.motor) {
    return { amount: thirdPartyPremium(a.motor.vehicleType, a.motor.engineCapacityCC), label: tr("Third-party cover (fixed by IRDAI)") };
  }
  return { amount: 0, label: null };
}

const COVERAGE_MULTIPLIERS: Record<string, number> = {
  BASIC: 0.85,
  STANDARD: 1.0,
  PREMIUM: 1.2,
  COMPREHENSIVE: 1.4,
};

/** Uses the unclamped raw score so protective factors (clean record,
 * anti-theft device) still earn a discount for profiles already at a
 * displayed score of 0, the way a good-driver discount would. */
function computeRiskMultiplier(rawScore: number): number {
  return round2(clamp(1 + (rawScore / 100) * 0.6, 0.9, 1.6));
}

function computeCoverageMultiplier(a: ApplicantProfile): number {
  return COVERAGE_MULTIPLIERS[a.policy.coverageLevel] ?? 1.0;
}

function computeLocationFactor(a: ApplicantProfile): number {
  // Term life isn't priced by city.
  if (a.policy.insuranceType === "LIFE") return 1;
  const loc = getLocationProfile(a.personal.location);
  let idx: number;
  if (a.motor) idx = loc.trafficDensity * 0.6 + loc.crimeIndex * 0.4;
  else if (a.property) idx = loc.floodRisk * 0.5 + loc.seismicRisk * 0.3 + loc.crimeIndex * 0.2;
  else idx = loc.costOfLivingIndex;
  return round2(0.9 + idx * 0.3);
}

function computeClaimHistoryFactor(a: ApplicantProfile): number {
  let claims = 0;
  if (a.motor) {
    // Motor rewards claim-free years through the NCB instead, so no discount here.
    claims = a.motor.previousClaims + a.motor.previousAccidents * 0.5;
    if (claims === 0) return 1;
  } else if (a.property) claims = a.property.previousClaims;
  else claims = a.claimsLast12Months ?? 0;

  if (claims === 0) return 0.95; // no-claim discount
  return round2(clamp(1 + Math.min(claims, 6) * 0.07, 1, 1.5));
}

function computeFraudAdjustment(fraud: FraudAssessmentResult): number {
  return round2(1 + (fraud.fraudScore / 100) * 0.15);
}

function computeDeductibleFactor(a: ApplicantProfile): number {
  return round2(clamp(1 - (a.policy.deductible / 100000) * 0.08, 0.6, 1.05));
}

export function calculatePremium(
  applicant: ApplicantProfile,
  risk: RiskAssessmentResult,
  fraud: FraudAssessmentResult,
): PremiumBreakdown {
  const basePremium = Math.round(computeBasePremium(applicant));
  const riskMultiplier = computeRiskMultiplier(risk.rawScore);
  const coverageMultiplier = computeCoverageMultiplier(applicant);
  const locationFactor = computeLocationFactor(applicant);
  const claimHistoryFactor = computeClaimHistoryFactor(applicant);
  const fraudAdjustment = computeFraudAdjustment(fraud);
  const deductibleFactor = computeDeductibleFactor(applicant);

  const fixed = computeFixedPremium(applicant);
  const ncbPercent = applicant.motor ? ncbFor(applicant.motor.claimFreeYears) : 0;
  const finalPremiumRaw =
    basePremium * riskMultiplier * coverageMultiplier * locationFactor * claimHistoryFactor * fraudAdjustment * deductibleFactor * (1 - ncbPercent / 100) +
    fixed.amount;

  // Round to the nearest 10 INR — matches how real insurers quote premiums.
  const finalPremium = Math.round(finalPremiumRaw / 10) * 10;

  return {
    basePremium,
    riskMultiplier,
    coverageMultiplier,
    locationFactor,
    claimHistoryFactor,
    fraudAdjustment,
    deductibleFactor,
    ncbPercent,
    fixedPremium: fixed.amount,
    fixedPremiumLabel: fixed.label,
    finalPremium,
    currency: "INR",
  };
}
