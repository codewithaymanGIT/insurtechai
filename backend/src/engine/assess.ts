// ============================================================================
// Assessment orchestrator — the single entry point that runs the full
// pipeline (risk -> fraud -> premium -> recommendations) for one applicant.
// This is the function both the API and the seed generator call, so a
// single applicant always gets a fully internally-consistent result.
// ============================================================================

import { ApplicantProfile, FullAssessmentResult } from "@insurtechai/shared";
import { assessRisk } from "./riskEngine";
import { assessFraud } from "./fraudEngine";
import { calculatePremium } from "./premiumEngine";
import { generateRecommendations } from "./recommendationEngine";
import { getMarketBenchmark } from "./marketBenchmark";
import { buildDecisionSummary } from "./decisionSummary";
import { normaliseMotor, describeMotorValue } from "./motorValue";
import { computeTaxBenefit } from "./taxBenefit";

export function runFullAssessment(input: ApplicantProfile): FullAssessmentResult {
  // Motor: IDV comes from the ex-showroom price and IRDAI's depreciation schedule where it applies.
  const applicant = normaliseMotor(input);
  const risk = assessRisk(applicant);
  const fraud = assessFraud(applicant);
  const premium = calculatePremium(applicant, risk, fraud);
  const recommendations = generateRecommendations(applicant, premium.finalPremium);
  const benchmark = getMarketBenchmark(applicant, premium.finalPremium);
  const decisionSummary = buildDecisionSummary(applicant, risk, premium, recommendations, benchmark);
  return {
    risk, premium, fraud, recommendations, decisionSummary,
    motorValue: describeMotorValue(applicant),
    tax: computeTaxBenefit(applicant, premium),
  };
}
