// ============================================================================
// InsurTechAI — Shared Domain Types
// Used by: backend (risk engine, premium engine, API) and frontend (UI/state)
// ============================================================================

export type InsuranceType = "HEALTH" | "MOTOR" | "PROPERTY" | "LIFE";

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
export type ExerciseFrequency = "NONE" | "OCCASIONAL" | "REGULAR" | "ATHLETE";
export type AlcoholUse = "NONE" | "OCCASIONAL" | "MODERATE" | "HEAVY";
export type VehicleType = "HATCHBACK" | "SEDAN" | "SUV" | "TWO_WHEELER" | "COMMERCIAL";
export type ConstructionType = "RCC_CONCRETE" | "BRICK_MASONRY" | "WOODEN" | "PREFAB" | "OTHER";
export type CoverageLevel = "BASIC" | "STANDARD" | "PREMIUM" | "COMPREHENSIVE";

export type RiskCategory = "Very Low" | "Low" | "Moderate" | "High" | "Very High";
export type AnomalyLevel = "Low" | "Moderate" | "High";
export type Effort = "Low" | "Medium" | "High";

/** Indian states/regions used to derive a deterministic geographic risk zone. */
export const LOCATIONS = [
  "Mumbai", "Pune", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata",
  "Ahmedabad", "Jaipur", "Lucknow", "Chandigarh", "Kochi", "Surat", "Nagpur",
  "Patna", "Bhopal", "Guwahati", "Coimbatore", "Indore", "Visakhapatnam",
] as const;
export type Location = (typeof LOCATIONS)[number];

// ---------------------------------------------------------------------------
// Applicant profile — segmented so irrelevant fields are never required
// ---------------------------------------------------------------------------

export interface PersonalProfile {
  age: number;
  gender: Gender;
  occupation: string;
  location: Location;
  annualIncome: number; // INR
  maritalStatus: MaritalStatus;
  dependents: number;
}

export interface HealthLifestyleProfile {
  bmi: number;
  smoker: boolean;
  alcoholUse: AlcoholUse;
  exerciseFrequency: ExerciseFrequency;
  existingConditions: string[]; // e.g. ["Diabetes", "Hypertension"]
  familyMedicalHistory: string[];
}

export interface MotorProfile {
  /** 0 = under 6 months, 0.5 = 6-12 months, then whole years. */
  vehicleAgeYears: number;
  /** Insured Declared Value. For vehicles under 5 years old with an
   * ex-showroom price, the backend recalculates it from IRDAI's schedule. */
  vehicleValue: number;
  /** Current ex-showroom price of the same model, used to derive the IDV. */
  exShowroomPrice?: number;
  /** Consecutive claim-free policy years (5 = five or more). Sets the NCB. */
  claimFreeYears?: number;
  vehicleType: VehicleType;
  engineCapacityCC: number;
  annualMileageKm: number;
  previousAccidents: number;
  previousClaims: number;
  drivingExperienceYears: number;
  trafficViolations: number;
  hasTrackingDevice: boolean;
}

export interface PropertyProfile {
  propertyValue: number; // INR
  propertyAgeYears: number;
  constructionType: ConstructionType;
  hasSecuritySystem: boolean;
  previousClaims: number;
  floodRiskZone: boolean;
  fireRiskZone: boolean;
  disasterExposureZone: boolean;
}

export interface LifeProfile {
  coverageAmount: number; // INR sum assured
  policyTermYears: number;
  occupationRiskClass: "LOW" | "MEDIUM" | "HIGH"; // e.g. desk job vs miner/pilot
  smoker: boolean; // the single strongest term-life rating factor after age
  preExistingConditions: boolean;
}

export interface PolicyMeta {
  insuranceType: InsuranceType;
  coverageLevel: CoverageLevel;
  deductible: number; // INR; higher deductible -> lower premium
}

/** Full applicant input. Health/Motor/Property/Life sub-profiles are optional
 *  and only the one matching `policy.insuranceType` is required by validation. */
export interface ApplicantProfile {
  personal: PersonalProfile;
  health?: HealthLifestyleProfile;
  motor?: MotorProfile;
  property?: PropertyProfile;
  life?: LifeProfile;
  policy: PolicyMeta;
  /** Number of claims filed in the last 12 months across all lines — used by fraud heuristics. */
  claimsLast12Months?: number;
  /** Timestamps (ISO) of recent claims — used to detect suspiciously clustered filings. */
  recentClaimDatesIso?: string[];
}

// ---------------------------------------------------------------------------
// Risk engine output
// ---------------------------------------------------------------------------

export type RiskFactorCategory =
  | "Age"
  | "Lifestyle"
  | "HistoricalClaims"
  | "Geographic"
  | "Asset"
  | "Behavioral"
  | "Fraud";

export interface RiskFactorContribution {
  name: string;
  category: RiskFactorCategory;
  /** Signed points contributed to the raw (pre-normalization) risk score. */
  impact: number;
  /** "negative" = increases risk (bad for applicant); "positive" = decreases risk (good). */
  direction: "positive" | "negative";
  description: string;
}

export interface RiskCategoryBreakdown {
  age: number;
  lifestyle: number;
  historicalClaims: number;
  geographic: number;
  asset: number;
  behavioral: number;
  fraud: number;
}

export interface RiskAssessmentResult {
  riskScore: number; // 0-100
  riskCategory: RiskCategory;
  insuranceType: InsuranceType;
  factors: RiskFactorContribution[];
  categoryBreakdown: RiskCategoryBreakdown;
  rawScore: number; // pre-normalization, for debugging/transparency
}

// ---------------------------------------------------------------------------
// Premium engine output
// ---------------------------------------------------------------------------

export interface PremiumBreakdown {
  /** The risk-rated part of the premium, before multipliers (motor: own-damage cover). */
  basePremium: number;
  riskMultiplier: number;
  coverageMultiplier: number;
  locationFactor: number;
  claimHistoryFactor: number;
  fraudAdjustment: number;
  deductibleFactor: number;
  /** Motor no-claim bonus applied to the own-damage part (0-50). 0 for other lines. */
  ncbPercent: number;
  /** Statutory part that risk doesn't change (motor third-party, fixed by IRDAI by engine size). 0 for other lines. */
  fixedPremium: number;
  fixedPremiumLabel: string | null;
  /** (basePremium × all multipliers) + fixedPremium, rounded to ₹10. Excludes 18% GST. */
  finalPremium: number;
  currency: "INR";
}

// ---------------------------------------------------------------------------
// Fraud / anomaly detection
// ---------------------------------------------------------------------------

export interface FraudSignal {
  code: string;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface FraudAssessmentResult {
  fraudScore: number; // 0-100
  anomalyLevel: AnomalyLevel;
  signals: FraudSignal[];
}

// ---------------------------------------------------------------------------
// Composite result returned by /api/risk-assessment
// ---------------------------------------------------------------------------

export interface FullAssessmentResult {
  risk: RiskAssessmentResult;
  premium: PremiumBreakdown;
  fraud: FraudAssessmentResult;
  recommendations: Recommendation[];
  decisionSummary: DecisionSummary;
  motorValue: MotorValue | null;
  tax: TaxBenefit;
}

/** How the IDV and no-claim bonus were worked out (motor only). */
export interface MotorValue {
  idv: number;
  exShowroomPrice: number | null;
  /** IRDAI depreciation applied, e.g. 30 for a 2-3 year old car; null when over 5 years (IDV agreed with insurer). */
  depreciationPercent: number | null;
  ageBand: string;
  ncbPercent: number;
  claimFreeYears: number;
  nextNcbPercent: number;
}

/** Income-tax deduction for the premium, Income-tax Act 2025 (from FY 2026-27). */
export interface TaxBenefit {
  applicable: boolean;
  /** e.g. "Section 126 (formerly 80D)" */
  section: string | null;
  premiumPaid: number;
  deduction: number;
  limit: number | null;
  /** Tax saved under the old regime, including 4% cess. */
  savedOldRegime: number;
  marginalRatePercent: number;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Market benchmark & decision support — grounds the computed premium against
// real, cited, publicly published Indian insurance premium ranges (not the
// platform's own synthetic data), and turns the score into a plain-language
// decision rather than a bare number. See backend/src/engine/marketBenchmark.ts
// for the source ranges and citations.
// ---------------------------------------------------------------------------

export interface MarketBenchmarkSource {
  label: string;
  url: string;
}

export type BenchmarkPosition = "below" | "within" | "above" | "unknown";

export interface MarketBenchmark {
  applicable: boolean;
  lowInr: number | null;
  medianInr: number | null;
  highInr: number | null;
  position: BenchmarkPosition;
  basis: string; // plain-language description of what the range represents
  sources: MarketBenchmarkSource[];
}

export type CoverageAdequacyVerdict = "under" | "adequate" | "over" | "unknown";

export interface CoverageAdequacy {
  applicable: boolean;
  verdict: CoverageAdequacyVerdict;
  message: string;
  ruleOfThumb: string | null;
}

export interface DecisionSummary {
  verdict: string; // one-line plain-language takeaway
  benchmark: MarketBenchmark;
  coverageAdequacy: CoverageAdequacy;
  nextSteps: string[];
}

// ---------------------------------------------------------------------------
// Recommendations / Premium Optimizer
// ---------------------------------------------------------------------------

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: RiskFactorCategory;
  estimatedSavingAmount: number; // INR, projected annual premium reduction
  estimatedSavingPercent: number;
  effort: Effort;
  /** estimatedSavingAmount / effort-weight — used to rank recommendations */
  impactPerEffort: number;
}

// ---------------------------------------------------------------------------
// Scenario simulation
// ---------------------------------------------------------------------------

export interface ScenarioSimulationRequest {
  baseline: ApplicantProfile;
  modified: ApplicantProfile;
  label?: string;
}

export interface ScenarioSimulationResult {
  baseline: FullAssessmentResult;
  scenario: FullAssessmentResult;
  riskScoreDelta: number;
  premiumDelta: number;
  premiumSavingsPercent: number;
  riskCategoryChanged: boolean;
}

// ---------------------------------------------------------------------------
// Model performance: real held-out metrics from the optional ML service
// (ml-service/train.py), trained on the synthetic sample portfolio.
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Portfolio dashboard
// ---------------------------------------------------------------------------

export interface PortfolioKpis {
  totalPolicies: number;
  totalInsuredValue: number;
  averagePremium: number;
  averageRiskScore: number;
  highRiskCustomers: number;
  potentialAnomalies: number;
  estimatedClaimsExposure: number;
  premiumRevenue: number;
  lossRatio: number;
  claimsFrequency: number;
}

export interface RiskDistributionBucket {
  category: RiskCategory;
  count: number;
}

// ---------------------------------------------------------------------------
// AI Risk Advisor — fixed question set, answered from the applicant's own
// calculated assessment (never a generic/canned response).
// ---------------------------------------------------------------------------

export type AdvisorQuestionId =
  | "WHY_PREMIUM_HIGH"
  | "HOW_TO_REDUCE"
  | "BIGGEST_RISK"
  | "WHICH_FACTOR_MOST"
  | "WHAT_SAVES_MOST"
  | "WHAT_TO_IMPROVE_FIRST";

export interface AdvisorQuestion {
  id: AdvisorQuestionId;
  label: string;
}

export const ADVISOR_QUESTIONS: AdvisorQuestion[] = [
  { id: "WHY_PREMIUM_HIGH", label: "Why is my premium high?" },
  { id: "HOW_TO_REDUCE", label: "How can I reduce my premium?" },
  { id: "BIGGEST_RISK", label: "What is my biggest risk?" },
  { id: "WHICH_FACTOR_MOST", label: "Which factor affects me the most?" },
  { id: "WHAT_SAVES_MOST", label: "What changes would save me the most money?" },
  { id: "WHAT_TO_IMPROVE_FIRST", label: "What should I improve first?" },
];

export interface CustomerSegment {
  segment:
    | "Low Risk / High Value"
    | "Low Risk / Low Value"
    | "Moderate Risk"
    | "High Risk"
    | "High Value / High Risk"
    | "Potential Fraud/Anomaly";
  count: number;
}
