// ============================================================================
// Fraud / Anomaly Detection — rule-based heuristic scoring.
//
// IMPORTANT (Responsible AI): this module NEVER asserts that an applicant
// "is committing fraud." It surfaces statistical anomalies worth a human
// underwriter's attention. Framing throughout uses "potential anomaly
// detected" language, matching the platform's realism rules.
// ============================================================================

import { ApplicantProfile, FraudAssessmentResult, FraudSignal, AnomalyLevel } from "@insurtechai/shared";
import { tr } from "../i18n";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Rough expected market value bands (INR) by vehicle type, at age 0,
 * depreciated ~12%/year — used only to flag gross inconsistencies, not to
 * price anything. */
const EXPECTED_VEHICLE_BASE_VALUE: Record<string, number> = {
  TWO_WHEELER: 90000,
  HATCHBACK: 600000,
  SEDAN: 950000,
  SUV: 1600000,
  COMMERCIAL: 1200000,
};

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

export function assessFraud(applicant: ApplicantProfile): FraudAssessmentResult {
  const signals: FraudSignal[] = [];
  let score = 0;

  // 1. Rapid claim clustering
  const dates = (applicant.recentClaimDatesIso ?? []).map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i], dates[i - 1]) <= 30) {
      signals.push({
        code: "RAPID_CLAIM_CLUSTER",
        message: tr("Two or more claims filed within 30 days of each other."),
        severity: "high",
      });
      score += 30;
      break;
    }
  }

  // 2. Unusual claim frequency in the last 12 months
  const claimsLast12 = applicant.claimsLast12Months ?? 0;
  if (claimsLast12 >= 4) {
    signals.push({ code: "HIGH_CLAIM_FREQUENCY", message: tr("{n} claims in the last 12 months, well above the usual rate. Expect an insurer to ask for claim documents.", { n: claimsLast12 }), severity: "high" });
    score += 25;
  } else if (claimsLast12 >= 2) {
    signals.push({ code: "ELEVATED_CLAIM_FREQUENCY", message: tr("{n} claims in the last 12 months, above the usual rate.", { n: claimsLast12 }), severity: "medium" });
    score += 12;
  }

  // 3. Motor: reported vehicle value inconsistent with type/age
  if (applicant.motor) {
    const base = EXPECTED_VEHICLE_BASE_VALUE[applicant.motor.vehicleType] ?? 800000;
    const expected = base * Math.pow(0.88, applicant.motor.vehicleAgeYears);
    const deviation = Math.abs(applicant.motor.vehicleValue - expected) / expected;
    // Only when the IDV was typed in by hand; one derived from the ex-showroom
    // price via IRDAI's schedule has nothing to cross-check.
    if (!applicant.motor.exShowroomPrice && deviation > 0.6) {
      signals.push({
        code: "VEHICLE_VALUE_MISMATCH",
        message: tr("The vehicle value entered is far from the usual value for its type and age. Insurers set the IDV themselves, so check this figure."),
        severity: "medium",
      });
      score += 15;
    }

    if (applicant.motor.previousClaims >= 2 && applicant.motor.drivingExperienceYears < 3) {
      signals.push({
        code: "CLAIM_COUNT_VS_EXPERIENCE",
        message: tr("The number of claims is high for the years of driving experience."),
        severity: "medium",
      });
      score += 12;
    }

    if ((applicant.motor.claimFreeYears ?? 0) >= 1 && (applicant.claimsLast12Months ?? 0) > 0) {
      signals.push({
        code: "NCB_CONFLICT",
        message: tr("A no-claim bonus is claimed, but a claim was also made in the last 12 months. A claim normally resets the bonus to zero, and insurers check this with your previous insurer."),
        severity: "medium",
      });
      score += 12;
    }

    if (applicant.motor.previousAccidents >= 3) {
      signals.push({
        code: "REPEATED_ACCIDENTS",
        message: tr("The number of past accidents is unusually high."),
        severity: "low",
      });
      score += 8;
    }
  }

  // 4. Property: value grossly inconsistent with disclosed income
  if (applicant.property) {
    const ratio = applicant.property.propertyValue / Math.max(applicant.personal.annualIncome, 1);
    if (ratio > 40) {
      signals.push({
        code: "PROPERTY_VALUE_VS_INCOME",
        message: tr("The property value is high relative to the income entered. An insurer may ask for a valuation."),
        severity: "medium",
      });
      score += 15;
    }

    if (applicant.property.previousClaims >= 3) {
      signals.push({
        code: "REPEATED_PROPERTY_CLAIMS",
        message: tr("Unusually many previous claims on one property."),
        severity: "medium",
      });
      score += 12;
    }
  }

  // 5. Health: extreme conditions count relative to age (possible over-disclosure or data error)
  if (applicant.health && applicant.health.existingConditions.length >= 4 && applicant.personal.age < 30) {
    signals.push({
      code: "CONDITIONS_VS_AGE",
      message: tr("Many declared conditions for this age. Expect the insurer to ask for medical tests."),
      severity: "low",
    });
    score += 8;
  }

  score = clamp(Math.round(score), 0, 100);
  const anomalyLevel: AnomalyLevel = score <= 30 ? "Low" : score <= 60 ? "Moderate" : "High";

  return { fraudScore: score, anomalyLevel, signals };
}
