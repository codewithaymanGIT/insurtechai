// ============================================================================
// Named, explainable risk factor calculators.
//
// Each function returns a list of RiskFactorContribution — signed point
// values on the SAME point scale as that category's weight in
// WEIGHT_PROFILES (see config.ts). The engine sums a category's factors and
// clamps to [0, categoryMaxPoints], so individual factors here are sized as
// fractions of the category max, not the full 0-100 scale.
// ============================================================================

import {
  ApplicantProfile,
  RiskFactorContribution,
  RiskCategory,
} from "@insurtechai/shared";
import { getLocationProfile, RiskCategoryKey, WEIGHT_PROFILES } from "./config";
import { tr } from "../i18n";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function factor(
  name: string,
  category: RiskFactorContribution["category"],
  impact: number,
  description: string,
): RiskFactorContribution {
  const rounded = Math.round(impact * 10) / 10;
  return {
    name,
    category,
    impact: rounded,
    direction: rounded >= 0 ? "negative" : "positive", // negative direction = increases risk
    description,
  };
}

// ---------------------------------------------------------------------------
// Age (universal, weight varies by insurance type)
// ---------------------------------------------------------------------------

export function ageFactors(a: ApplicantProfile, maxPoints: number): RiskFactorContribution[] {
  if (maxPoints === 0) return [];
  const { age } = a.personal;
  const type = a.policy.insuranceType;

  if (type === "MOTOR") {
    if (age < 25) return [factor(tr("Young driver"), "Age", maxPoints * 0.7, tr("Drivers under 25 (you're {age}) have the highest accident rates of any age group.", { age }))];
    if (age < 30) return [factor(tr("Driver age 25–29"), "Age", maxPoints * 0.3, tr("Accident rates are still above average at {age}, and fall through the late twenties.", { age }))];
    if (age >= 70) return [factor(tr("Driver age 70+"), "Age", maxPoints * 0.5, tr("Accident rates rise again after 70 (you're {age}).", { age }))];
    if (age >= 60) return [factor(tr("Driver age 60–69"), "Age", maxPoints * 0.2, tr("Accident rates start rising gradually after 60 (you're {age}).", { age }))];
    return [factor(tr("Experienced driving age"), "Age", -maxPoints * 0.15, tr("Drivers aged 30–59 have the lowest accident rates."))];
  }

  // Health and life: claim and mortality risk climb steadily with age.
  const points = maxPoints * Math.max(-0.15, Math.min(1, (age - 30) / 40));
  if (points <= -1) return [factor(tr("Younger age"), "Age", points, tr("At {age}, health and mortality risk are below the adult average.", { age }))];
  if (points >= 1) {
    const description = type === "LIFE"
      ? tr("Mortality risk rises steadily with age, and is priced in by every insurer.")
      : tr("The chance of hospitalisation rises steadily with age, and is priced in by every insurer.");
    return [factor(tr("Age {age}", { age }), "Age", points, description)];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Lifestyle (Health / Life)
// ---------------------------------------------------------------------------

export function lifestyleFactors(a: ApplicantProfile, maxPoints: number): RiskFactorContribution[] {
  if (maxPoints === 0) return [];
  if (!a.health) return lifeOnlyLifestyleFactors(a, maxPoints);
  const h = a.health;
  const out: RiskFactorContribution[] = [];

  if (h.smoker) {
    out.push(factor(tr("Smoker"), "Lifestyle", maxPoints * 0.3, tr("Smoking raises the likelihood and cost of hospital claims more than almost any other habit.")));
  } else {
    out.push(factor(tr("Non-smoker"), "Lifestyle", -maxPoints * 0.08, tr("Non-smokers are priced at the standard rate.")));
  }

  if (h.bmi >= 30) {
    out.push(factor(tr("High BMI"), "Lifestyle", maxPoints * 0.18, tr("A BMI of {bmi} is in the obese range, which raises the risk of diabetes, heart disease and joint problems.", { bmi: h.bmi.toFixed(1) })));
  } else if (h.bmi < 18.5) {
    out.push(factor(tr("Low BMI"), "Lifestyle", maxPoints * 0.08, tr("A BMI of {bmi} is below the healthy range of 18.5–25.", { bmi: h.bmi.toFixed(1) })));
  } else if (h.bmi >= 18.5 && h.bmi < 25) {
    out.push(factor(tr("Healthy BMI"), "Lifestyle", -maxPoints * 0.06, tr("A BMI of {bmi} is in the healthy range.", { bmi: h.bmi.toFixed(1) })));
  }

  if (h.alcoholUse === "HEAVY") {
    out.push(factor(tr("Heavy drinking"), "Lifestyle", maxPoints * 0.14, tr("Heavy drinking raises the risk of liver disease, injury and hospital stays.")));
  } else if (h.alcoholUse === "MODERATE") {
    out.push(factor(tr("Moderate drinking"), "Lifestyle", maxPoints * 0.05, tr("Moderate drinking adds a small amount of long-term risk.")));
  }

  if (h.exerciseFrequency === "NONE") {
    out.push(factor(tr("Sedentary lifestyle"), "Lifestyle", maxPoints * 0.1, tr("No regular exercise is linked to higher rates of chronic illness.")));
  } else if (h.exerciseFrequency === "REGULAR" || h.exerciseFrequency === "ATHLETE") {
    out.push(factor(tr("Regular exercise"), "Lifestyle", -maxPoints * 0.08, tr("Regular exercise is linked to fewer chronic illnesses.")));
  }

  if (h.existingConditions.length > 0) {
    out.push(factor(tr("Declared medical conditions"), "Lifestyle", maxPoints * Math.min(0.22, h.existingConditions.length * 0.08), tr("Declared conditions ({conditions}) make a claim more likely. Most insurers also apply a waiting period to them.", { conditions: h.existingConditions.join(", ") })));
  }

  if (h.familyMedicalHistory.length > 0) {
    out.push(factor(tr("Family medical history"), "Lifestyle", maxPoints * Math.min(0.12, h.familyMedicalHistory.length * 0.05), tr("A family history of {conditions} raises hereditary risk.", { conditions: h.familyMedicalHistory.join(", ") })));
  }

  return out;
}

/** LIFE applicants who haven't separately disclosed a full health sub-profile
 * still give a life insurer the two questions that matter most on a term
 * proposal form: smoker status and any pre-existing condition. Without this,
 * every LIFE assessment submitted through the UI (which never shows the
 * Health card) would silently score 0 of this category's weight — a
 * structural gap, not a stylistic one. */
function lifeOnlyLifestyleFactors(a: ApplicantProfile, maxPoints: number): RiskFactorContribution[] {
  if (!a.life) return [];
  const out: RiskFactorContribution[] = [];

  if (a.life.smoker) {
    out.push(factor(tr("Smoker"), "Lifestyle", maxPoints * 0.45, tr("After age, smoking is the biggest factor in term-life pricing. Insurers usually charge smokers 40–60% more for the same cover.")));
  } else {
    out.push(factor(tr("Non-smoker"), "Lifestyle", -maxPoints * 0.1, tr("Term-life rates are usually quoted for non-smokers, so this keeps you at the base rate.")));
  }

  if (a.life.preExistingConditions) {
    out.push(factor(tr("Declared pre-existing condition"), "Lifestyle", maxPoints * 0.4, tr("A declared condition usually means medical tests, and may add a loading or an exclusion to the policy.")));
  } else {
    out.push(factor(tr("No declared conditions"), "Lifestyle", -maxPoints * 0.08, tr("With no declared conditions, you would normally get standard rates.")));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Historical claims (Motor / Property / Health via claimsLast12Months)
// ---------------------------------------------------------------------------

export function historicalClaimsFactors(a: ApplicantProfile, maxPoints: number): RiskFactorContribution[] {
  if (maxPoints === 0) return [];
  const out: RiskFactorContribution[] = [];

  if (a.motor) {
    const { previousAccidents, previousClaims } = a.motor;
    if (previousAccidents > 0) {
      out.push(factor(tr("Previous accidents"), "HistoricalClaims", maxPoints * Math.min(0.8, previousAccidents * 0.22), previousAccidents === 1 ? tr("One accident on record. Past accidents are the strongest predictor of future claims.") : tr("{n} accidents on record. Past accidents are the strongest predictor of future claims.", { n: previousAccidents })));
    }
    if (previousClaims > 0) {
      out.push(factor(tr("Previous claims"), "HistoricalClaims", maxPoints * Math.min(0.6, previousClaims * 0.16), previousClaims === 1 ? tr("One previous claim. Each claim also resets your no-claim bonus.") : tr("{n} previous claims. Each claim also resets your no-claim bonus.", { n: previousClaims })));
    }
    if (previousAccidents === 0 && previousClaims === 0 && a.motor.drivingExperienceYears >= 3) {
      out.push(factor(tr("Clean driving record"), "HistoricalClaims", -maxPoints * 0.3, tr("No accidents or claims on record, which is the best predictor of a low-claim future.")));
    }
  }

  if (a.property) {
    const { previousClaims } = a.property;
    if (previousClaims > 0) {
      out.push(factor(tr("Previous property claims"), "HistoricalClaims", maxPoints * Math.min(0.85, previousClaims * 0.3), previousClaims === 1 ? tr("One previous claim on this property.") : tr("{n} previous claims on this property.", { n: previousClaims })));
    } else {
      out.push(factor(tr("Claim-free property history"), "HistoricalClaims", -maxPoints * 0.2, tr("No previous claims on this property.")));
    }
  }

  if (!a.motor && !a.property && typeof a.claimsLast12Months === "number") {
    if (a.claimsLast12Months > 0) {
      out.push(factor(tr("Recent claims"), "HistoricalClaims", maxPoints * Math.min(0.8, a.claimsLast12Months * 0.35), a.claimsLast12Months === 1 ? tr("One claim in the last 12 months.") : tr("{n} claims in the last 12 months.", { n: a.claimsLast12Months })));
    } else {
      out.push(factor(tr("No recent claims"), "HistoricalClaims", -maxPoints * 0.15, tr("No claims in the last 12 months.")));
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Geographic
// ---------------------------------------------------------------------------

export function geographicFactors(a: ApplicantProfile, maxPoints: number): RiskFactorContribution[] {
  if (maxPoints === 0) return [];
  const loc = getLocationProfile(a.personal.location);
  const out: RiskFactorContribution[] = [];

  // Location indices realistically span roughly [0.2, 0.9] (see
  // LOCATION_PROFILES) — normalize against that observed range rather than
  // [0,1] so a genuinely high-risk location can approach the category's
  // full point allocation instead of a fraction of it.
  const normalize = (idx: number, lo = 0.25, hi = 0.85) => clamp((idx - lo) / (hi - lo), -0.3, 1);

  if (a.motor) {
    const idx = loc.trafficDensity * 0.7 + loc.crimeIndex * 0.3;
    out.push(factor(tr("City traffic and theft rates"), "Geographic", maxPoints * normalize(idx), idx > 0.65
      ? tr("{city} rates high for traffic density and vehicle theft among the 20 cities this model covers.", { city: a.personal.location })
      : idx > 0.4
        ? tr("{city} rates moderate for traffic density and vehicle theft among the 20 cities this model covers.", { city: a.personal.location })
        : tr("{city} rates low for traffic density and vehicle theft among the 20 cities this model covers.", { city: a.personal.location })));
  } else if (a.property) {
    const idx = loc.floodRisk * 0.5 + loc.seismicRisk * 0.3 + loc.crimeIndex * 0.2;
    out.push(factor(tr("City flood and earthquake exposure"), "Geographic", maxPoints * normalize(idx), idx > 0.55
      ? tr("{city} rates high for flood and earthquake exposure among the 20 cities this model covers.", { city: a.personal.location })
      : idx > 0.3
        ? tr("{city} rates moderate for flood and earthquake exposure among the 20 cities this model covers.", { city: a.personal.location })
        : tr("{city} rates low for flood and earthquake exposure among the 20 cities this model covers.", { city: a.personal.location })));
  } else {
    const idx = loc.costOfLivingIndex;
    out.push(factor(tr("City healthcare costs"), "Geographic", maxPoints * normalize(idx), idx > 0.65
      ? tr("Treatment costs in {city} are above average for the cities this model covers, which changes what a claim costs.", { city: a.personal.location })
      : tr("Treatment costs in {city} are around or below average for the cities this model covers, which changes what a claim costs.", { city: a.personal.location })));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Asset (Motor vehicle value/age, Property value/construction)
// ---------------------------------------------------------------------------

export function assetFactors(a: ApplicantProfile, maxPoints: number): RiskFactorContribution[] {
  if (maxPoints === 0) return [];
  const out: RiskFactorContribution[] = [];

  if (a.motor) {
    const m = a.motor;
    if (m.vehicleAgeYears >= 8) {
      out.push(factor(tr("Older vehicle"), "Asset", maxPoints * 0.35, tr("At {years} years old, parts wear out and breakdown-related claims become more likely.", { years: m.vehicleAgeYears })));
    } else if (m.vehicleAgeYears <= 2) {
      out.push(factor(tr("New vehicle"), "Asset", -maxPoints * 0.1, tr("Newer vehicles break down less often.")));
    }
    if (m.engineCapacityCC > 1500) {
      out.push(factor(tr("High engine capacity"), "Asset", maxPoints * 0.25, tr("A {cc}cc engine is linked to faster driving and costlier repairs.", { cc: m.engineCapacityCC })));
    }
    if (m.vehicleValue > 1500000) {
      out.push(factor(tr("High insured vehicle value"), "Asset", maxPoints * 0.2, tr("A more expensive vehicle costs more to repair or replace.")));
    }
  }

  if (a.property) {
    const p = a.property;
    if (p.propertyAgeYears >= 25) {
      out.push(factor(tr("Older property structure"), "Asset", maxPoints * Math.min(0.5, 0.25 + (p.propertyAgeYears - 25) * 0.01), tr("At {years} years old, wiring, plumbing and structure are more likely to fail.", { years: p.propertyAgeYears })));
    }
    if (p.constructionType === "WOODEN") {
      out.push(factor(tr("Wooden construction"), "Asset", maxPoints * 0.45, tr("Wooden buildings are far more exposed to fire than concrete or brick.")));
    } else if (p.constructionType === "PREFAB" || p.constructionType === "OTHER") {
      out.push(factor(tr("Non-standard construction type"), "Asset", maxPoints * 0.25, tr("Prefab and non-standard construction is less resilient than reinforced concrete.")));
    } else if (p.constructionType === "RCC_CONCRETE") {
      out.push(factor(tr("RCC concrete construction"), "Asset", -maxPoints * 0.12, tr("Reinforced concrete (RCC) holds up best against fire and structural damage.")));
    }
    if (p.propertyValue > 10000000) {
      out.push(factor(tr("High insured property value"), "Asset", maxPoints * 0.2, tr("A higher-value property costs more to repair or rebuild.")));
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Behavioral (Motor mileage/experience/violations/tracking, Property security,
// Life occupation risk class)
// ---------------------------------------------------------------------------

export function behavioralFactors(a: ApplicantProfile, maxPoints: number): RiskFactorContribution[] {
  if (maxPoints === 0) return [];
  const out: RiskFactorContribution[] = [];

  if (a.motor) {
    const m = a.motor;
    if (m.annualMileageKm > 15000) {
      out.push(factor(tr("High annual mileage"), "Behavioral", maxPoints * Math.min(0.3, (m.annualMileageKm - 15000) / 30000), tr("{km} km a year means more time on the road and more exposure to accidents.", { km: m.annualMileageKm.toLocaleString("en-IN") })));
    } else if (m.annualMileageKm < 6000) {
      out.push(factor(tr("Low annual mileage"), "Behavioral", -maxPoints * 0.15, tr("{km} km a year is well below average.", { km: m.annualMileageKm.toLocaleString("en-IN") })));
    }

    if (m.drivingExperienceYears < 2) {
      out.push(factor(tr("Limited driving experience"), "Behavioral", maxPoints * 0.25, m.drivingExperienceYears === 1 ? tr("One year of driving experience. Accident rates drop sharply after the first few years.") : tr("{n} years of driving experience. Accident rates drop sharply after the first few years.", { n: m.drivingExperienceYears })));
    } else if (m.drivingExperienceYears >= 10) {
      out.push(factor(tr("Experienced driver"), "Behavioral", -maxPoints * 0.12, tr("{n} years behind the wheel.", { n: m.drivingExperienceYears })));
    }

    if (m.trafficViolations > 0) {
      out.push(factor(tr("Traffic violations"), "Behavioral", maxPoints * Math.min(0.35, m.trafficViolations * 0.15), m.trafficViolations === 1 ? tr("One traffic violation on record.") : tr("{n} traffic violations on record.", { n: m.trafficViolations })));
    }

    if (m.hasTrackingDevice) {
      out.push(factor(tr("Anti-theft device fitted"), "Behavioral", -maxPoints * 0.2, tr("A fitted anti-theft or tracking device lowers theft risk. Most insurers offer a discount for an ARAI-approved one.")));
    }
  }

  if (a.property) {
    if (a.property.hasSecuritySystem) {
      out.push(factor(tr("Security system fitted"), "Behavioral", -maxPoints * 0.35, tr("A security system lowers the risk of burglary claims.")));
    } else {
      out.push(factor(tr("No security system"), "Behavioral", maxPoints * 0.5, tr("Without a security system, burglary risk is higher.")));
    }
  }

  if (a.life) {
    const riskClassPoints: Record<string, number> = { LOW: -0.15, MEDIUM: 0.2, HIGH: 0.7 };
    out.push(factor(tr("Occupation"), "Behavioral", maxPoints * riskClassPoints[a.life.occupationRiskClass], a.life.occupationRiskClass === "LOW" ? tr("Your job is in the low-risk class.") : a.life.occupationRiskClass === "HIGH" ? tr("Your job is in the high-risk class.") : tr("Your job is in the medium-risk class.")));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Category dispatch table used by the main engine
// ---------------------------------------------------------------------------

export const CATEGORY_BUILDERS: Record<
  RiskCategoryKey,
  (a: ApplicantProfile, maxPoints: number) => RiskFactorContribution[]
> = {
  age: ageFactors,
  lifestyle: lifestyleFactors,
  historicalClaims: historicalClaimsFactors,
  geographic: geographicFactors,
  asset: assetFactors,
  behavioral: behavioralFactors,
  fraud: () => [], // populated by the engine from the fraud module's score, not a standalone builder
};
