// ============================================================================
// Data access layer — keeps raw Drizzle queries out of route handlers.
//
// All functions are async: the libsql driver (see client.ts) executes
// queries asynchronously even for a local file, unlike the previous
// better-sqlite3 driver. Method names (.run()/.all()/.get()) are unchanged
// from the synchronous version — only `async`/`await` was added.
// ============================================================================

import { db } from "./client";
import * as schema from "./schema";
import { eq, desc, sql } from "drizzle-orm";
import { ApplicantProfile, FullAssessmentResult } from "@insurtechai/shared";
import { genId } from "./schema";

function toRiskCategoryEnum(cat: string): "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH" {
  return cat.toUpperCase().replace(/ /g, "_") as any;
}

export async function createApplicant(profile: ApplicantProfile, userId?: string): Promise<string> {
  const applicantId = genId();
  await db.insert(schema.applicants).values({
    id: applicantId,
    userId: userId ?? null,
    age: profile.personal.age,
    gender: profile.personal.gender,
    occupation: profile.personal.occupation,
    location: profile.personal.location,
    annualIncome: profile.personal.annualIncome,
    maritalStatus: profile.personal.maritalStatus,
    dependents: profile.personal.dependents,
    healthProfile: profile.health ? JSON.stringify(profile.health) : null,
    motorProfile: profile.motor ? JSON.stringify(profile.motor) : null,
    propertyProfile: profile.property ? JSON.stringify(profile.property) : null,
    lifeProfile: profile.life ? JSON.stringify(profile.life) : null,
  }).run();
  return applicantId;
}

export async function createPolicy(applicantId: string, profile: ApplicantProfile): Promise<{ policyId: string; policyNumber: string }> {
  const policyId = genId();
  const policyNumber = `ITA-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`;
  await db.insert(schema.policies).values({
    id: policyId,
    applicantId,
    insuranceType: profile.policy.insuranceType,
    coverageLevel: profile.policy.coverageLevel,
    deductible: profile.policy.deductible,
    policyNumber,
  }).run();
  return { policyId, policyNumber };
}

export async function createApplicantWithPolicy(profile: ApplicantProfile, userId?: string) {
  const applicantId = await createApplicant(profile, userId);
  const { policyId, policyNumber } = await createPolicy(applicantId, profile);
  return { applicantId, policyId, policyNumber };
}

export async function persistAssessment(policyId: string, result: FullAssessmentResult) {
  const riskAssessmentId = genId();
  await db.insert(schema.riskAssessments).values({
    id: riskAssessmentId,
    policyId,
    riskScore: result.risk.riskScore,
    rawScore: result.risk.rawScore,
    riskCategory: toRiskCategoryEnum(result.risk.riskCategory),
    categoryBreakdownJson: JSON.stringify(result.risk.categoryBreakdown),
  }).run();

  if (result.risk.factors.length > 0) {
    await db.insert(schema.riskFactors).values(
      result.risk.factors.map((f) => ({
        id: genId(),
        riskAssessmentId,
        name: f.name,
        category: f.category,
        impact: f.impact,
        direction: f.direction,
        description: f.description,
      })),
    ).run();
  }

  await db.insert(schema.premiumCalculations).values({
    id: genId(),
    policyId,
    riskAssessmentId,
    basePremium: result.premium.basePremium,
    riskMultiplier: result.premium.riskMultiplier,
    coverageMultiplier: result.premium.coverageMultiplier,
    locationFactor: result.premium.locationFactor,
    claimHistoryFactor: result.premium.claimHistoryFactor,
    fraudAdjustment: result.premium.fraudAdjustment,
    deductibleFactor: result.premium.deductibleFactor,
    finalPremium: result.premium.finalPremium,
  }).run();

  await db.insert(schema.fraudAssessments).values({
    id: genId(),
    policyId,
    riskAssessmentId,
    fraudScore: result.fraud.fraudScore,
    anomalyLevel: result.fraud.anomalyLevel.toUpperCase() as "LOW" | "MODERATE" | "HIGH",
    signalsJson: JSON.stringify(result.fraud.signals),
  }).run();

  if (result.recommendations.length > 0) {
    await db.insert(schema.recommendations).values(
      result.recommendations.map((r) => ({
        id: genId(),
        riskAssessmentId,
        title: r.title,
        description: r.description,
        category: r.category,
        estimatedSavingAmount: r.estimatedSavingAmount,
        estimatedSavingPercent: r.estimatedSavingPercent,
        effort: r.effort,
        impactPerEffort: r.impactPerEffort,
      })),
    ).run();
  }

  return riskAssessmentId;
}

export async function saveScenario(applicantId: string, label: string, baseline: FullAssessmentResult, scenario: FullAssessmentResult) {
  const id = genId();
  await db.insert(schema.scenarios).values({
    id,
    applicantId,
    label,
    baselineJson: JSON.stringify(baseline),
    scenarioJson: JSON.stringify(scenario),
    riskScoreDelta: scenario.risk.riskScore - baseline.risk.riskScore,
    premiumDelta: scenario.premium.finalPremium - baseline.premium.finalPremium,
  }).run();
  return id;
}

export async function listApplicants(params: {
  limit?: number;
  offset?: number;
  insuranceType?: string;
  riskCategory?: string;
  location?: string;
}) {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  // Latest risk assessment + policy per applicant, joined for list display.
  const rows = await db.all<{
    applicantId: string; age: number; occupation: string; location: string; annualIncome: number;
    policyId: string; insuranceType: string; policyNumber: string; coverageLevel: string;
    riskScore: number | null; riskCategory: string | null; finalPremium: number | null; fraudScore: number | null;
  }>(sql`
    SELECT
      a.id as applicantId, a.age, a.occupation, a.location, a.annual_income as annualIncome,
      p.id as policyId, p.insurance_type as insuranceType, p.policy_number as policyNumber, p.coverage_level as coverageLevel,
      ra.risk_score as riskScore, ra.risk_category as riskCategory,
      pc.final_premium as finalPremium, fa.fraud_score as fraudScore
    FROM applicants a
    JOIN policies p ON p.applicant_id = a.id
    LEFT JOIN risk_assessments ra ON ra.id = (
      SELECT id FROM risk_assessments WHERE policy_id = p.id ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN premium_calculations pc ON pc.risk_assessment_id = ra.id
    LEFT JOIN fraud_assessments fa ON fa.risk_assessment_id = ra.id
    WHERE a.user_id IS NULL
    ${params.insuranceType ? sql`AND p.insurance_type = ${params.insuranceType}` : sql``}
    ${params.riskCategory ? sql`AND ra.risk_category = ${params.riskCategory}` : sql``}
    ${params.location ? sql`AND a.location = ${params.location}` : sql``}
    ORDER BY ra.risk_score DESC, p.policy_number ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return rows;
}

/** Sample-portfolio applicants only (user_id IS NULL). */
export async function getApplicantDetail(applicantId: string) {
  const applicant = await db.select().from(schema.applicants).where(eq(schema.applicants.id, applicantId)).get();
  if (!applicant || applicant.userId !== null) return null;

  const policiesRows = await db.select().from(schema.policies).where(eq(schema.policies.applicantId, applicantId)).all();
  const policyIds = policiesRows.map((p) => p.id);

  const assessments = policyIds.length
    ? await db.select().from(schema.riskAssessments).where(sql`${schema.riskAssessments.policyId} IN ${policyIds}`).orderBy(desc(schema.riskAssessments.createdAt)).all()
    : [];
  const assessmentIds = assessments.map((a) => a.id);

  const factors = assessmentIds.length
    ? await db.select().from(schema.riskFactors).where(sql`${schema.riskFactors.riskAssessmentId} IN ${assessmentIds}`).all()
    : [];
  const premiums = assessmentIds.length
    ? await db.select().from(schema.premiumCalculations).where(sql`${schema.premiumCalculations.riskAssessmentId} IN ${assessmentIds}`).all()
    : [];
  const fraudAssessments = assessmentIds.length
    ? await db.select().from(schema.fraudAssessments).where(sql`${schema.fraudAssessments.riskAssessmentId} IN ${assessmentIds}`).all()
    : [];
  const recs = assessmentIds.length
    ? await db.select().from(schema.recommendations).where(sql`${schema.recommendations.riskAssessmentId} IN ${assessmentIds}`).all()
    : [];
  const claimsRows = policyIds.length
    ? await db.select().from(schema.claims).where(sql`${schema.claims.policyId} IN ${policyIds}`).orderBy(desc(schema.claims.claimDate)).all()
    : [];
  const scenarioRows = await db.select().from(schema.scenarios).where(eq(schema.scenarios.applicantId, applicantId)).orderBy(desc(schema.scenarios.createdAt)).all();

  return {
    applicant,
    policies: policiesRows,
    riskAssessments: assessments,
    riskFactors: factors,
    premiumCalculations: premiums,
    fraudAssessments,
    recommendations: recs,
    claims: claimsRows,
    scenarios: scenarioRows,
  };
}

/** Counts policy rows matching the same filters as listApplicants, for pagination. */
export async function countApplicants(params: { insuranceType?: string; riskCategory?: string; location?: string } = {}): Promise<number> {
  const row = await db.get<{ c: number }>(sql`
    SELECT COUNT(*) as c
    FROM applicants a
    JOIN policies p ON p.applicant_id = a.id
    LEFT JOIN risk_assessments ra ON ra.id = (
      SELECT id FROM risk_assessments WHERE policy_id = p.id ORDER BY created_at DESC LIMIT 1
    )
    WHERE a.user_id IS NULL
    ${params.insuranceType ? sql`AND p.insurance_type = ${params.insuranceType}` : sql``}
    ${params.riskCategory ? sql`AND ra.risk_category = ${params.riskCategory}` : sql``}
    ${params.location ? sql`AND a.location = ${params.location}` : sql``}
  `);
  return row?.c ?? 0;
}

export interface DashboardRow {
  applicantId: string;
  age: number;
  location: string;
  annualIncome: number;
  motorProfile: string | null;
  propertyProfile: string | null;
  lifeProfile: string | null;
  policyId: string;
  insuranceType: string;
  riskScore: number | null;
  riskCategory: string | null;
  finalPremium: number | null;
  fraudScore: number | null;
  anomalyLevel: string | null;
  assessedAt: string | null;
}

/** Every policy's latest risk/premium/fraud snapshot, joined with the
 * applicant fields needed for portfolio-level aggregation and segmentation. */
export async function getDashboardRows(): Promise<DashboardRow[]> {
  return db.all<DashboardRow>(sql`
    SELECT
      a.id as applicantId, a.age, a.location, a.annual_income as annualIncome,
      a.motor_profile as motorProfile, a.property_profile as propertyProfile, a.life_profile as lifeProfile,
      p.id as policyId, p.insurance_type as insuranceType,
      ra.risk_score as riskScore, ra.risk_category as riskCategory, ra.created_at as assessedAt,
      pc.final_premium as finalPremium,
      fa.fraud_score as fraudScore, fa.anomaly_level as anomalyLevel
    FROM policies p
    JOIN applicants a ON a.id = p.applicant_id
    LEFT JOIN risk_assessments ra ON ra.id = (
      SELECT id FROM risk_assessments WHERE policy_id = p.id ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN premium_calculations pc ON pc.risk_assessment_id = ra.id
    LEFT JOIN fraud_assessments fa ON fa.risk_assessment_id = ra.id
    WHERE a.user_id IS NULL
  `);
}

export interface ClaimRow {
  claimAmount: number;
  claimDate: string;
  status: string;
  insuranceType: string;
}

export async function getAllClaims(): Promise<ClaimRow[]> {
  return db.all<ClaimRow>(sql`
    SELECT c.claim_amount as claimAmount, c.claim_date as claimDate, c.status,
           p.insurance_type as insuranceType
    FROM claims c
    JOIN policies p ON p.id = c.policy_id
    JOIN applicants a ON a.id = p.applicant_id
    WHERE a.user_id IS NULL
  `);
}
