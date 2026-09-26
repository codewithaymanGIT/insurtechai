// ============================================================================
// Synthetic demo data seeder.
//
// Generates ~500 applicants / ~700 policies / 1000+ claims by running EVERY
// synthetic applicant through the real risk/premium/fraud engines (same
// code path as the live API), so the seeded portfolio is internally
// consistent: risk scores, premiums, fraud flags and claim histories all
// derive from the same underlying feature set rather than being
// independently randomized.
// ============================================================================

import { client, db } from "../db/client";
import * as schema from "../db/schema";
import { genId } from "../db/schema";
import { runFullAssessment } from "../engine/assess";
import { generateApplicant, randInt, randFloat, pick, weightedBool } from "./generators";
import { InsuranceType } from "@insurtechai/shared";

const TARGET_APPLICANTS = 500;
// Roughly 40% of applicants get a second policy of a different type.
const SECOND_POLICY_PROBABILITY = 0.4;

const CLAIM_TYPE_BY_INSURANCE: Record<InsuranceType, string[]> = {
  MOTOR: ["Accident", "Theft", "Windshield Damage", "Third-Party Liability"],
  PROPERTY: ["Fire Damage", "Flood Damage", "Burglary", "Structural Damage"],
  HEALTH: ["Hospitalization", "Outpatient Treatment", "Surgery", "Diagnostic Tests"],
  LIFE: ["Rider Payout"],
};

function randomPastDate(monthsBack: number): Date {
  const now = Date.now();
  const past = now - randInt(1, monthsBack * 30) * 24 * 60 * 60 * 1000;
  return new Date(past);
}

function randomPastDateInRange(minMonthsBack: number, maxMonthsBack: number): Date {
  const now = Date.now();
  const past = now - randInt(minMonthsBack * 30, maxMonthsBack * 30) * 24 * 60 * 60 * 1000;
  return new Date(past);
}

// Claim severity is deliberately capped well below insured value — a
// realistic own-damage/medical claim rarely approaches the full sum
// insured, and this keeps the portfolio's loss ratio in a plausible
// 40-90% band rather than an inflated multiple of premium.
function claimAmountFor(type: InsuranceType, referenceValue: number): number {
  switch (type) {
    case "MOTOR": return Math.round(randFloat(3000, Math.max(10000, referenceValue * 0.045), 0) / 100) * 100;
    case "PROPERTY": return Math.round(randFloat(6000, Math.max(18000, referenceValue * 0.022), 0) / 100) * 100;
    case "HEALTH": return Math.round(randFloat(2500, 45000, 0) / 100) * 100;
    case "LIFE": return Math.round(referenceValue * randFloat(0.05, 0.2, 3));
  }
}

function claimStatus(): string {
  const r = Math.random();
  if (r < 0.78) return "SETTLED";
  if (r < 0.9) return "UNDER_REVIEW";
  return "REJECTED";
}

async function clearAllTables() {
  const tables = [
    "recommendations", "fraud_assessments", "premium_calculations", "risk_factors",
    "risk_assessments", "claims", "scenarios", "policies", "applicants",
  ];
  for (const t of tables) await client.execute(`DELETE FROM ${t};`);
}

async function seed() {
  // --if-empty: used on deploy, so redeploys keep the existing sample book.
  if (process.argv.includes("--if-empty")) {
    const { rows } = await client.execute("SELECT COUNT(*) AS n FROM applicants");
    if (Number(rows[0].n) > 0) {
      console.log(`Sample portfolio already has ${rows[0].n} applicants; skipping seed.`);
      return;
    }
  }
  console.log("Clearing existing data...");
  await clearAllTables();

  let totalPolicies = 0;
  let totalClaims = 0;
  const riskCategoryCounts: Record<string, number> = {};
  const insuranceTypes: InsuranceType[] = ["HEALTH", "MOTOR", "PROPERTY", "LIFE"];

  console.log(`Generating ${TARGET_APPLICANTS} applicants...`);

  for (let i = 0; i < TARGET_APPLICANTS; i++) {
    const primaryType = insuranceTypes[i % insuranceTypes.length]; // even spread across types
    const { profile: primaryProfile } = generateApplicant(primaryType);

    // Persist applicant once
    const applicantId = genId();
    await db.insert(schema.applicants).values({
      id: applicantId,
      age: primaryProfile.personal.age,
      gender: primaryProfile.personal.gender,
      occupation: primaryProfile.personal.occupation,
      location: primaryProfile.personal.location,
      annualIncome: primaryProfile.personal.annualIncome,
      maritalStatus: primaryProfile.personal.maritalStatus,
      dependents: primaryProfile.personal.dependents,
      healthProfile: primaryProfile.health ? JSON.stringify(primaryProfile.health) : null,
      motorProfile: primaryProfile.motor ? JSON.stringify(primaryProfile.motor) : null,
      propertyProfile: primaryProfile.property ? JSON.stringify(primaryProfile.property) : null,
      lifeProfile: primaryProfile.life ? JSON.stringify(primaryProfile.life) : null,
    }).run();

    const profilesToWrite = [primaryProfile];

    // ~40% chance of a second policy of a different type, reusing the same
    // personal profile (same applicant, different sub-profile).
    if (weightedBool(SECOND_POLICY_PROBABILITY)) {
      const otherTypes = insuranceTypes.filter((t) => t !== primaryType);
      const secondType = pick(otherTypes);
      const { profile: secondSub } = generateApplicant(secondType);
      profilesToWrite.push({ ...secondSub, personal: primaryProfile.personal });
    }

    for (const profile of profilesToWrite) {
      const policyId = genId();
      const policyNumber = `ITA-${2024 + (i % 3)}-${100000 + i}-${profile.policy.insuranceType.slice(0, 2)}`;
      const startedAt = randomPastDate(24).toISOString();

      await db.insert(schema.policies).values({
        id: policyId,
        applicantId,
        insuranceType: profile.policy.insuranceType,
        coverageLevel: profile.policy.coverageLevel,
        deductible: profile.policy.deductible,
        policyNumber,
        startedAt,
      }).run();
      totalPolicies++;

      // Run the REAL engines — this is the same code path the live API uses.
      const result = runFullAssessment(profile);
      riskCategoryCounts[result.risk.riskCategory] = (riskCategoryCounts[result.risk.riskCategory] ?? 0) + 1;

      const riskAssessmentId = genId();
      const assessedAt = randomPastDate(6).toISOString(); // assessments run more recently than policy inception
      await db.insert(schema.riskAssessments).values({
        id: riskAssessmentId,
        policyId,
        riskScore: result.risk.riskScore,
        rawScore: result.risk.rawScore,
        riskCategory: result.risk.riskCategory.toUpperCase().replace(/ /g, "_") as any,
        categoryBreakdownJson: JSON.stringify(result.risk.categoryBreakdown),
        createdAt: assessedAt,
      }).run();

      if (result.risk.factors.length > 0) {
        await db.insert(schema.riskFactors).values(
          result.risk.factors.map((f) => ({
            id: genId(), riskAssessmentId, name: f.name, category: f.category,
            impact: f.impact, direction: f.direction, description: f.description,
          })),
        ).run();
      }

      await db.insert(schema.premiumCalculations).values({
        id: genId(), policyId, riskAssessmentId,
        basePremium: result.premium.basePremium, riskMultiplier: result.premium.riskMultiplier,
        coverageMultiplier: result.premium.coverageMultiplier, locationFactor: result.premium.locationFactor,
        claimHistoryFactor: result.premium.claimHistoryFactor, fraudAdjustment: result.premium.fraudAdjustment,
        deductibleFactor: result.premium.deductibleFactor, finalPremium: result.premium.finalPremium,
        createdAt: assessedAt,
      }).run();

      await db.insert(schema.fraudAssessments).values({
        id: genId(), policyId, riskAssessmentId,
        fraudScore: result.fraud.fraudScore,
        anomalyLevel: result.fraud.anomalyLevel.toUpperCase() as any,
        signalsJson: JSON.stringify(result.fraud.signals),
        createdAt: assessedAt,
      }).run();

      if (result.recommendations.length > 0) {
        await db.insert(schema.recommendations).values(
          result.recommendations.map((r) => ({
            id: genId(), riskAssessmentId, title: r.title, description: r.description,
            category: r.category, estimatedSavingAmount: r.estimatedSavingAmount,
            estimatedSavingPercent: r.estimatedSavingPercent, effort: r.effort, impactPerEffort: r.impactPerEffort,
          })),
        ).run();
      }

      // --- Claims: count is DERIVED from the same fields the risk engine
      // used, so the claims table and the risk score stay consistent.
      let claimCount = 0;
      let referenceValue = 500000;
      if (profile.motor) {
        claimCount = profile.motor.previousClaims + profile.motor.previousAccidents;
        referenceValue = profile.motor.vehicleValue;
      } else if (profile.property) {
        claimCount = profile.property.previousClaims;
        referenceValue = profile.property.propertyValue;
      } else if (profile.policy.insuranceType === "HEALTH") {
        claimCount = profile.claimsLast12Months ?? 0;
        referenceValue = profile.personal.annualIncome;
      } else if (profile.life) {
        claimCount = weightedBool(0.03) ? 1 : 0; // rare rider payout
        referenceValue = profile.life.coverageAmount;
      }

      // Older historical claims beyond the "recent claims" window the risk
      // engine scores on — real claims tables run deeper than the lookback
      // window pricing uses, so this pads realistic volume/time-series depth
      // without touching any number the risk/premium engines consumed.
      let olderClaimCount = 0;
      if (profile.policy.insuranceType !== "LIFE" && weightedBool(0.5)) {
        olderClaimCount = randInt(1, 4);
      }

      const claimTypes = CLAIM_TYPE_BY_INSURANCE[profile.policy.insuranceType];
      const anomalousDates = profile.recentClaimDatesIso;

      for (let c = 0; c < claimCount; c++) {
        // Spread over a 4-year lookback (not just the trailing 12 months)
        // so the dashboard's trailing-12-month loss ratio/claim frequency
        // land in a realistic band instead of implying every policy claims
        // every year.
        const claimDate = anomalousDates && anomalousDates[c] ? anomalousDates[c] : randomPastDate(48).toISOString();
        await db.insert(schema.claims).values({
          id: genId(),
          policyId,
          claimAmount: claimAmountFor(profile.policy.insuranceType, referenceValue),
          claimDate,
          claimType: pick(claimTypes),
          status: claimStatus(),
          description: null,
        }).run();
        totalClaims++;
      }

      for (let c = 0; c < olderClaimCount; c++) {
        await db.insert(schema.claims).values({
          id: genId(),
          policyId,
          claimAmount: claimAmountFor(profile.policy.insuranceType, referenceValue),
          claimDate: randomPastDateInRange(48, 84).toISOString(),
          claimType: pick(claimTypes),
          status: "SETTLED",
          description: null,
        }).run();
        totalClaims++;
      }
    }

    if ((i + 1) % 100 === 0) console.log(`  ...${i + 1}/${TARGET_APPLICANTS} applicants processed`);
  }

  console.log("\nSeed complete.");
  console.log(`  Applicants: ${TARGET_APPLICANTS}`);
  console.log(`  Policies:   ${totalPolicies}`);
  console.log(`  Claims:     ${totalClaims}`);
  console.log(`  Risk category distribution:`, riskCategoryCounts);
}

seed()
  .then(() => client.close())
  .catch((err) => {
    console.error("Seed failed:", err);
    client.close();
    process.exit(1);
  });
