// ============================================================================
// Decision summary: turns the score and premium into something a person can
// act on. A plain-language verdict, how the estimate compares with published
// market ranges, a cover-adequacy check against a named rule of thumb, and
// next steps drawn from the re-simulated recommendations.
// ============================================================================

import { ApplicantProfile, RiskAssessmentResult, PremiumBreakdown, Recommendation, MarketBenchmark, CoverageAdequacy, DecisionSummary } from "@insurtechai/shared";
import { getLocationProfile } from "./config";
import { tr, N_ } from "../i18n";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const COVER_NAME: Record<string, string> = { BASIC: N_("Basic"), STANDARD: N_("Standard"), PREMIUM: N_("Premium"), COMPREHENSIVE: N_("Comprehensive") };

function buildVerdict(risk: RiskAssessmentResult, premium: PremiumBreakdown, benchmark: MarketBenchmark): string {
  const riskPart: Record<string, string> = {
    "Very Low": tr("Your risk profile is very low."),
    Low: tr("Your risk profile is low."),
    Moderate: tr("Your risk profile is moderate. A few factors are pushing the price up."),
    High: tr("Your risk profile is high. Several factors are pushing the price up."),
    "Very High": tr("Your risk profile is very high across several areas."),
  };
  let verdict = riskPart[risk.riskCategory] ?? "";
  if (benchmark.applicable && benchmark.position !== "unknown" && benchmark.lowInr != null && benchmark.highInr != null) {
    const v = { amount: inr(premium.finalPremium), low: inr(benchmark.lowInr), high: inr(benchmark.highInr) };
    const cmp: Record<string, string> = {
      below: tr("At {amount} a year, the estimate is below the usual published range of {low}–{high}.", v),
      within: tr("At {amount} a year, the estimate is within the usual published range of {low}–{high}.", v),
      above: tr("At {amount} a year, the estimate is above the usual published range of {low}–{high}. The factors below show why.", v),
    };
    const c = cmp[benchmark.position];
    if (c) verdict += " " + c;
  }
  return verdict.trim();
}

function buildCoverageAdequacy(a: ApplicantProfile): CoverageAdequacy {
  if (a.life) {
    const income = a.personal.annualIncome;
    if (!income || income <= 0) {
      return { applicable: false, verdict: "unknown", message: tr("Add your annual income to check whether this cover is enough."), ruleOfThumb: null };
    }
    const multiple = a.life.coverageAmount / income;
    const ruleOfThumb = tr("Financial planners commonly suggest term cover of 10–15 times annual income, adjusted for dependents and loans. It's a guideline, not an insurer or IRDAI requirement.");
    const x = multiple.toFixed(1);
    const n = a.personal.dependents;
    if (multiple < 8) {
      const message = n === 1
        ? tr("Your cover is {x}× your annual income, below the usual 10–15×. With one dependent, that may leave a gap.", { x })
        : n > 0
          ? tr("Your cover is {x}× your annual income, below the usual 10–15×. With {n} dependents, that may leave a gap.", { x, n })
          : tr("Your cover is {x}× your annual income, below the usual 10–15×.", { x });
      return { applicable: true, verdict: "under", message, ruleOfThumb };
    }
    if (multiple > 18) {
      return { applicable: true, verdict: "over", message: tr("Your cover is {x}× your annual income, well above the usual 10–15×. Check whether a lower sum assured would do the same job for less.", { x }), ruleOfThumb };
    }
    return { applicable: true, verdict: "adequate", message: tr("Your cover is {x}× your annual income, in line with the usual 10–15×.", { x }), ruleOfThumb };
  }

  if (a.health) {
    const loc = getLocationProfile(a.personal.location);
    const isMetro = loc.costOfLivingIndex >= 0.75;
    const thin = a.policy.coverageLevel === "BASIC" || a.policy.coverageLevel === "STANDARD";
    const ruleOfThumb = tr("Hospital costs are higher and rise faster in metro cities, so advisors usually suggest a higher sum insured there. This is general guidance, not a regulatory figure.");
    const tier = tr(COVER_NAME[a.policy.coverageLevel]);
    const city = a.personal.location;
    if (isMetro && thin) {
      return { applicable: true, verdict: "under", message: tr("Hospital costs in {city} are among the highest in India. At the {tier} tier, check that the sum insured would cover a major hospital stay there.", { city, tier }), ruleOfThumb };
    }
    return { applicable: true, verdict: "adequate", message: tr("The {tier} tier is a reasonable starting point for {city}.", { tier, city }), ruleOfThumb };
  }

  return {
    applicable: false,
    verdict: "unknown",
    message: tr("For vehicle and home cover, what matters is insuring at the right value (the IDV or property value you entered). There's no income-based rule to check against."),
    ruleOfThumb: null,
  };
}

function buildNextSteps(a: ApplicantProfile, premium: PremiumBreakdown, recommendations: Recommendation[], benchmark: MarketBenchmark, coverageAdequacy: CoverageAdequacy): string[] {
  const steps: string[] = [];

  const topRec = [...recommendations].sort((x, y) => y.impactPerEffort - x.impactPerEffort)[0];
  if (topRec) {
    steps.push(tr("{title}. Estimated saving: {amount} a year.", { title: topRec.title, amount: inr(topRec.estimatedSavingAmount) }));
  }

  if (benchmark.applicable && benchmark.position === "above" && benchmark.highInr != null) {
    steps.push(tr("Get at least two real quotes before buying. This estimate is above the usual range, which tops out around {amount}.", { amount: inr(benchmark.highInr) }));
  } else if (benchmark.applicable) {
    steps.push(tr("Compare this against real quotes from two or three insurers or an aggregator before you buy."));
  }

  if (coverageAdequacy.applicable && coverageAdequacy.verdict === "under") {
    steps.push(coverageAdequacy.message);
  }

  if (a.policy.insuranceType === "MOTOR" && a.motor && !a.motor.hasTrackingDevice) {
    steps.push(tr("Ask insurers about an anti-theft device discount. An ARAI-approved device usually qualifies."));
  }

  return steps.slice(0, 4);
}

export function buildDecisionSummary(
  applicant: ApplicantProfile,
  risk: RiskAssessmentResult,
  premium: PremiumBreakdown,
  recommendations: Recommendation[],
  benchmark: MarketBenchmark,
): DecisionSummary {
  const coverageAdequacy = buildCoverageAdequacy(applicant);
  return {
    verdict: buildVerdict(risk, premium, benchmark),
    benchmark,
    coverageAdequacy,
    nextSteps: buildNextSteps(applicant, premium, recommendations, benchmark, coverageAdequacy),
  };
}
