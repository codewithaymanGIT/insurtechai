// ============================================================================
// Synthetic applicant generators.
//
// Design principle: generate RAW FEATURES with realistic random variance
// (including deliberate outliers/anomalies), then let the real risk/premium/
// fraud engines derive score, premium and anomaly flags from those features.
// Nothing about risk score or premium is generated independently — that is
// what keeps the seeded portfolio statistically internally consistent.
//
// Applicants are generated across four risk TIERS (rather than a single
// highRisk boolean) so the resulting portfolio spreads across all five
// risk categories the way a real book of business would, instead of
// clustering almost entirely at "Very Low".
// ============================================================================

import { ApplicantProfile, InsuranceType, Location, LOCATIONS, idvFromExShowroom } from "@insurtechai/shared";

/** Simple deterministic PRNG (mulberry32) so a re-seed run is reproducible. */
function makeRng(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260101);

export const rand = () => rng();
export const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
export const randFloat = (min: number, max: number, decimals = 1) => {
  const v = rand() * (max - min) + min;
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
};
export function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
export function weightedBool(pTrue: number): boolean {
  return rand() < pTrue;
}

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

function pickTier(): RiskTier {
  const r = rand();
  if (r < 0.48) return "LOW";
  if (r < 0.76) return "MEDIUM";
  if (r < 0.93) return "HIGH";
  return "EXTREME";
}

const OCCUPATIONS = [
  "Software Engineer", "Doctor", "Teacher", "Accountant", "Sales Executive", "Bank Manager",
  "Civil Engineer", "Lawyer", "Nurse", "Business Owner", "Government Officer", "Pilot",
  "Delivery Driver", "Electrician", "Architect", "Marketing Manager", "Chartered Accountant",
  "Police Officer", "Miner", "Consultant",
];
const HIGH_RISK_OCCUPATIONS = new Set(["Pilot", "Miner", "Police Officer", "Delivery Driver", "Electrician"]);

const HEALTH_CONDITIONS = ["Diabetes", "Hypertension", "Asthma", "Thyroid disorder", "Heart disease", "Arthritis"];
const FAMILY_HISTORY = ["Diabetes", "Heart disease", "Cancer", "Hypertension"];

export function randomLocation(): Location {
  return pick(LOCATIONS);
}

/** Age is deliberately correlated with tier: age is one of the biggest
 * weighted risk factors for HEALTH/LIFE, so leaving it fully independent
 * of tier would dilute the tier system's effect on those categories. */
function randomAgeForTier(tier: RiskTier): number {
  switch (tier) {
    case "LOW": return randInt(28, 55); // prime working age -> often gets a small bonus
    case "MEDIUM": return randInt(22, 65);
    case "HIGH": return weightedBool(0.6) ? randInt(60, 75) : randInt(18, 23);
    case "EXTREME": return weightedBool(0.55) ? randInt(68, 80) : randInt(18, 21);
  }
}

function randomPersonal(tier: RiskTier) {
  const age = randomAgeForTier(tier);
  return {
    age,
    gender: pick(["MALE", "FEMALE", "OTHER"] as const),
    occupation: pick(OCCUPATIONS),
    location: randomLocation(),
    annualIncome: Math.round(randFloat(250000, 4500000, 0) / 1000) * 1000,
    maritalStatus: pick(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const),
    dependents: randInt(0, 4),
  };
}

function randomHealthProfile(tier: RiskTier) {
  const ranges: Record<RiskTier, { bmi: [number, number]; conditions: [number, number]; smokerP: number; exercise: readonly string[] }> = {
    LOW: { bmi: [18.5, 25], conditions: [0, 0], smokerP: 0.05, exercise: ["REGULAR", "REGULAR", "ATHLETE"] },
    MEDIUM: { bmi: [22, 29], conditions: [0, 1], smokerP: 0.2, exercise: ["OCCASIONAL", "OCCASIONAL", "REGULAR"] },
    HIGH: { bmi: [27, 35], conditions: [1, 2], smokerP: 0.45, exercise: ["NONE", "OCCASIONAL"] },
    EXTREME: { bmi: [32, 42], conditions: [2, 4], smokerP: 0.7, exercise: ["NONE", "NONE"] },
  };
  const r = ranges[tier];
  const conditionCount = randInt(r.conditions[0], r.conditions[1]);
  return {
    bmi: randFloat(r.bmi[0], r.bmi[1], 1),
    smoker: weightedBool(r.smokerP),
    alcoholUse: tier === "EXTREME" ? pick(["HEAVY", "HEAVY", "MODERATE"] as const)
      : tier === "HIGH" ? pick(["MODERATE", "HEAVY"] as const)
      : tier === "MEDIUM" ? pick(["NONE", "OCCASIONAL", "MODERATE"] as const)
      : pick(["NONE", "NONE", "OCCASIONAL"] as const),
    exerciseFrequency: pick(r.exercise as any) as "NONE" | "OCCASIONAL" | "REGULAR" | "ATHLETE",
    existingConditions: Array.from({ length: conditionCount }, () => pick(HEALTH_CONDITIONS)),
    familyMedicalHistory: weightedBool(0.35) ? [pick(FAMILY_HISTORY)] : [],
  };
}

function randomMotorProfile(tier: RiskTier, anomalous: boolean) {
  const vehicleType = pick(["HATCHBACK", "SEDAN", "SUV", "TWO_WHEELER", "COMMERCIAL"] as const);
  const baseValue: Record<string, number> = { HATCHBACK: 600000, SEDAN: 950000, SUV: 1600000, TWO_WHEELER: 90000, COMMERCIAL: 1200000 };

  const ranges: Record<RiskTier, {
    age: [number, number]; mileage: [number, number]; accidents: [number, number];
    claims: [number, number]; experience: [number, number]; violations: [number, number]; trackingP: number;
  }> = {
    LOW: { age: [0, 5], mileage: [2000, 9000], accidents: [0, 0], claims: [0, 0], experience: [6, 30], violations: [0, 0], trackingP: 0.5 },
    MEDIUM: { age: [2, 9], mileage: [7000, 16000], accidents: [0, 1], claims: [0, 1], experience: [3, 20], violations: [0, 1], trackingP: 0.3 },
    HIGH: { age: [5, 13], mileage: [14000, 26000], accidents: [1, 2], claims: [1, 2], experience: [1, 10], violations: [1, 3], trackingP: 0.15 },
    EXTREME: { age: [8, 18], mileage: [22000, 40000], accidents: [2, 5], claims: [2, 4], experience: [0, 3], violations: [3, 7], trackingP: 0.05 },
  };
  const r = ranges[tier];
  const vehicleAgeYears = Math.min(randInt(r.age[0], r.age[1]), 20);
  const exShowroom = Math.round((baseValue[vehicleType] * randFloat(0.85, 1.15, 2)) / 1000) * 1000;
  // Up to 5 years old the IDV follows the depreciation schedule; older vehicles
  // get an agreed value. Anomalous profiles overstate a manual IDV instead.
  const scheduledIdv = !anomalous ? idvFromExShowroom(exShowroom, vehicleAgeYears) : null;
  let vehicleValue = scheduledIdv ?? Math.round(baseValue[vehicleType] * Math.pow(0.88, vehicleAgeYears) * randFloat(0.85, 1.15, 2));
  if (anomalous) vehicleValue = Math.round(vehicleValue * randFloat(1.8, 2.6, 2));
  const previousAccidents = randInt(r.accidents[0], r.accidents[1]);
  const previousClaims = randInt(r.claims[0], r.claims[1]);
  // NCB transfers between vehicles, so a new car can still carry claim-free years.
  const claimFreeYears = previousClaims === 0 ? randInt(tier === "LOW" ? 1 : 0, 5) : randInt(0, 1);

  return {
    vehicleAgeYears,
    vehicleValue,
    ...(scheduledIdv ? { exShowroomPrice: exShowroom } : {}),
    claimFreeYears,
    vehicleType,
    engineCapacityCC: vehicleType === "TWO_WHEELER" ? randInt(100, 250) : randInt(1000, tier === "LOW" ? 1600 : 2500),
    annualMileageKm: randInt(r.mileage[0], r.mileage[1]),
    previousAccidents,
    previousClaims,
    drivingExperienceYears: randInt(r.experience[0], r.experience[1]),
    trafficViolations: randInt(r.violations[0], r.violations[1]),
    hasTrackingDevice: weightedBool(r.trackingP),
  };
}

function randomPropertyProfile(tier: RiskTier, anomalous: boolean, income: number) {
  const ranges: Record<RiskTier, { age: [number, number]; claims: [number, number]; securityP: number; construction: readonly string[] }> = {
    LOW: { age: [0, 10], claims: [0, 0], securityP: 0.65, construction: ["RCC_CONCRETE", "RCC_CONCRETE", "BRICK_MASONRY"] },
    MEDIUM: { age: [8, 25], claims: [0, 1], securityP: 0.4, construction: ["RCC_CONCRETE", "BRICK_MASONRY"] },
    HIGH: { age: [20, 45], claims: [1, 2], securityP: 0.2, construction: ["BRICK_MASONRY", "PREFAB"] },
    EXTREME: { age: [35, 70], claims: [2, 4], securityP: 0.05, construction: ["WOODEN", "PREFAB", "OTHER"] },
  };
  const r = ranges[tier];
  let propertyValue = Math.round(randFloat(1500000, 25000000, 0) / 10000) * 10000;
  if (anomalous) propertyValue = Math.round(income * randFloat(45, 70, 1));
  return {
    propertyValue,
    propertyAgeYears: randInt(r.age[0], r.age[1]),
    constructionType: pick(r.construction as any) as "RCC_CONCRETE" | "BRICK_MASONRY" | "WOODEN" | "PREFAB" | "OTHER",
    hasSecuritySystem: weightedBool(r.securityP),
    previousClaims: randInt(r.claims[0], r.claims[1]),
    floodRiskZone: weightedBool(tier === "EXTREME" || tier === "HIGH" ? 0.5 : 0.25),
    fireRiskZone: weightedBool(0.15),
    disasterExposureZone: weightedBool(tier === "EXTREME" ? 0.4 : 0.15),
  };
}

const LIFE_SMOKER_PROBABILITY: Record<RiskTier, number> = { LOW: 0.08, MEDIUM: 0.15, HIGH: 0.3, EXTREME: 0.45 };
const LIFE_PREEXISTING_PROBABILITY: Record<RiskTier, number> = { LOW: 0.05, MEDIUM: 0.12, HIGH: 0.25, EXTREME: 0.4 };

function randomLifeProfile(occupation: string, tier: RiskTier) {
  const forcedHigh = HIGH_RISK_OCCUPATIONS.has(occupation) || tier === "EXTREME" || (tier === "HIGH" && weightedBool(0.65));
  const forcedMedium = tier === "HIGH" || tier === "MEDIUM";
  return {
    coverageAmount: Math.round(randFloat(1000000, 20000000, 0) / 100000) * 100000,
    policyTermYears: randInt(5, 30),
    occupationRiskClass: (forcedHigh ? "HIGH" : forcedMedium ? "MEDIUM" : "LOW") as "LOW" | "MEDIUM" | "HIGH",
    smoker: weightedBool(LIFE_SMOKER_PROBABILITY[tier]),
    preExistingConditions: weightedBool(LIFE_PREEXISTING_PROBABILITY[tier]),
  };
}

/** Probability a LIFE applicant also discloses a health sub-profile
 * (used for the Lifestyle risk category). Higher tiers attach it more
 * often — a higher-risk life applicant is also more likely to have
 * disclosed relevant health information underwriters would ask for. */
function lifeHealthAttachProbability(tier: RiskTier): number {
  return { LOW: 0.4, MEDIUM: 0.55, HIGH: 0.85, EXTREME: 1.0 }[tier];
}

/** Generates one applicant + a chosen insurance type's profile, drawn from
 * a randomly assigned risk tier (48% Low / 28% Medium / 17% High / 6%
 * Extreme) so the seeded portfolio spans all five risk categories rather
 * than clustering at one end. `anomalous` is injected at a fixed ~6% rate
 * independent of tier, for the fraud module to detect. */
export function generateApplicant(insuranceType: InsuranceType): { profile: ApplicantProfile; tier: RiskTier; anomalous: boolean } {
  const tier = pickTier();
  const anomalous = weightedBool(0.06);
  const personal = randomPersonal(tier);

  const profile: ApplicantProfile = {
    personal,
    policy: {
      insuranceType,
      coverageLevel: pick(["BASIC", "STANDARD", "PREMIUM", "COMPREHENSIVE"] as const),
      deductible: pick([0, 5000, 10000, 25000, 50000]),
    },
  };

  if (insuranceType === "HEALTH") {
    profile.health = randomHealthProfile(tier);
    const claimRanges: Record<RiskTier, [number, number]> = { LOW: [0, 0], MEDIUM: [0, 1], HIGH: [1, 2], EXTREME: [2, 4] };
    const [lo, hi] = claimRanges[tier];
    profile.claimsLast12Months = randInt(lo, hi);
  } else if (insuranceType === "MOTOR") {
    profile.motor = randomMotorProfile(tier, anomalous);
    profile.claimsLast12Months = profile.motor.previousClaims;
  } else if (insuranceType === "PROPERTY") {
    profile.property = randomPropertyProfile(tier, anomalous, personal.annualIncome);
    profile.claimsLast12Months = profile.property.previousClaims;
  } else {
    profile.life = randomLifeProfile(personal.occupation, tier);
    profile.health = weightedBool(lifeHealthAttachProbability(tier)) ? randomHealthProfile(tier) : undefined;
    profile.claimsLast12Months = 0;
  }

  if (anomalous && (profile.claimsLast12Months ?? 0) >= 2) {
    // Cluster the claims within a short window to trigger the rapid-claim signal
    const base = Date.now() - randInt(10, 300) * 24 * 60 * 60 * 1000;
    profile.recentClaimDatesIso = Array.from({ length: profile.claimsLast12Months! }, (_, i) =>
      new Date(base + i * 5 * 24 * 60 * 60 * 1000).toISOString(),
    );
  }

  return { profile, tier, anomalous };
}
