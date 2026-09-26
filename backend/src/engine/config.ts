// ============================================================================
// Risk engine configuration — weights are deliberately data, not code, so a
// non-engineer (an actuarial/pricing analyst) could tune them without
// touching the calculation logic. Values below are illustrative starting
// points, not calibrated against real claims data (see README/Responsible AI).
// ============================================================================

import { InsuranceType } from "@insurtechai/shared";

export type RiskCategoryKey =
  | "age"
  | "lifestyle"
  | "historicalClaims"
  | "geographic"
  | "asset"
  | "behavioral"
  | "fraud";

/** Max points each category can contribute to the 0-100 risk score, per
 * insurance type. Each profile MUST sum to 100 — enforced at module load
 * by `assertWeightProfilesValid` below so a misconfiguration fails loudly
 * at startup rather than silently producing an unscaled score. */
export const WEIGHT_PROFILES: Record<InsuranceType, Record<RiskCategoryKey, number>> = {
  HEALTH: { age: 20, lifestyle: 45, historicalClaims: 10, geographic: 10, asset: 0, behavioral: 0, fraud: 15 },
  MOTOR: { age: 10, lifestyle: 0, historicalClaims: 30, geographic: 15, asset: 15, behavioral: 25, fraud: 5 },
  PROPERTY: { age: 0, lifestyle: 0, historicalClaims: 20, geographic: 30, asset: 25, behavioral: 20, fraud: 5 },
  LIFE: { age: 30, lifestyle: 30, historicalClaims: 0, geographic: 10, asset: 0, behavioral: 20, fraud: 10 },
};

function assertWeightProfilesValid() {
  for (const [type, profile] of Object.entries(WEIGHT_PROFILES)) {
    const sum = Object.values(profile).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.001) {
      throw new Error(`Risk weight profile for ${type} sums to ${sum}, must sum to 100`);
    }
  }
}
assertWeightProfilesValid();

/** Deterministic geographic risk proxies per location. Values are 0-1
 * illustrative indices (NOT sourced from actual insurer loss data), used
 * to make the geographic risk factor reproducible and explainable rather
 * than random. */
export interface LocationProfile {
  trafficDensity: number; // used for motor risk
  floodRisk: number; // used for property risk
  seismicRisk: number; // used for property risk
  costOfLivingIndex: number; // used for health/life geographic variation
  crimeIndex: number; // used for property/motor theft risk
}

export const LOCATION_PROFILES: Record<string, LocationProfile> = {
  Mumbai: { trafficDensity: 0.9, floodRisk: 0.85, seismicRisk: 0.3, costOfLivingIndex: 0.95, crimeIndex: 0.55 },
  Pune: { trafficDensity: 0.7, floodRisk: 0.35, seismicRisk: 0.3, costOfLivingIndex: 0.7, crimeIndex: 0.4 },
  Delhi: { trafficDensity: 0.95, floodRisk: 0.3, seismicRisk: 0.55, costOfLivingIndex: 0.85, crimeIndex: 0.6 },
  Bengaluru: { trafficDensity: 0.9, floodRisk: 0.25, seismicRisk: 0.2, costOfLivingIndex: 0.8, crimeIndex: 0.4 },
  Hyderabad: { trafficDensity: 0.75, floodRisk: 0.3, seismicRisk: 0.2, costOfLivingIndex: 0.65, crimeIndex: 0.35 },
  Chennai: { trafficDensity: 0.8, floodRisk: 0.75, seismicRisk: 0.2, costOfLivingIndex: 0.7, crimeIndex: 0.4 },
  Kolkata: { trafficDensity: 0.85, floodRisk: 0.7, seismicRisk: 0.35, costOfLivingIndex: 0.6, crimeIndex: 0.5 },
  Ahmedabad: { trafficDensity: 0.65, floodRisk: 0.4, seismicRisk: 0.65, costOfLivingIndex: 0.55, crimeIndex: 0.35 },
  Jaipur: { trafficDensity: 0.55, floodRisk: 0.2, seismicRisk: 0.4, costOfLivingIndex: 0.5, crimeIndex: 0.4 },
  Lucknow: { trafficDensity: 0.6, floodRisk: 0.3, seismicRisk: 0.4, costOfLivingIndex: 0.45, crimeIndex: 0.45 },
  Chandigarh: { trafficDensity: 0.5, floodRisk: 0.2, seismicRisk: 0.45, costOfLivingIndex: 0.6, crimeIndex: 0.25 },
  Kochi: { trafficDensity: 0.55, floodRisk: 0.8, seismicRisk: 0.15, costOfLivingIndex: 0.55, crimeIndex: 0.3 },
  Surat: { trafficDensity: 0.6, floodRisk: 0.6, seismicRisk: 0.6, costOfLivingIndex: 0.5, crimeIndex: 0.35 },
  Nagpur: { trafficDensity: 0.5, floodRisk: 0.25, seismicRisk: 0.3, costOfLivingIndex: 0.4, crimeIndex: 0.4 },
  Patna: { trafficDensity: 0.6, floodRisk: 0.7, seismicRisk: 0.55, costOfLivingIndex: 0.35, crimeIndex: 0.55 },
  Bhopal: { trafficDensity: 0.45, floodRisk: 0.3, seismicRisk: 0.4, costOfLivingIndex: 0.4, crimeIndex: 0.4 },
  Guwahati: { trafficDensity: 0.5, floodRisk: 0.65, seismicRisk: 0.9, costOfLivingIndex: 0.4, crimeIndex: 0.35 },
  Coimbatore: { trafficDensity: 0.5, floodRisk: 0.3, seismicRisk: 0.15, costOfLivingIndex: 0.45, crimeIndex: 0.25 },
  Indore: { trafficDensity: 0.5, floodRisk: 0.25, seismicRisk: 0.3, costOfLivingIndex: 0.4, crimeIndex: 0.35 },
  Visakhapatnam: { trafficDensity: 0.55, floodRisk: 0.7, seismicRisk: 0.2, costOfLivingIndex: 0.4, crimeIndex: 0.3 },
};

export function getLocationProfile(location: string): LocationProfile {
  return LOCATION_PROFILES[location] ?? {
    trafficDensity: 0.5, floodRisk: 0.4, seismicRisk: 0.4, costOfLivingIndex: 0.5, crimeIndex: 0.4,
  };
}

export const RISK_CATEGORY_THRESHOLDS: { max: number; label: import("@insurtechai/shared").RiskCategory }[] = [
  { max: 20, label: "Very Low" },
  { max: 40, label: "Low" },
  { max: 60, label: "Moderate" },
  { max: 80, label: "High" },
  { max: 100, label: "Very High" },
];

export function categorizeRiskScore(score: number): import("@insurtechai/shared").RiskCategory {
  for (const bucket of RISK_CATEGORY_THRESHOLDS) {
    if (score <= bucket.max) return bucket.label;
  }
  return "Very High";
}
