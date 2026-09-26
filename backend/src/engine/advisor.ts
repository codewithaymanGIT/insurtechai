// ============================================================================
// Explanations and the six preset advisor answers. Every sentence is built
// from the applicant's computed factors and recommendations.
// ============================================================================

import { AdvisorQuestionId, FullAssessmentResult, RiskFactorContribution } from "@insurtechai/shared";
import { tr } from "../i18n";

function fmtInr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function topNegative(factors: RiskFactorContribution[]): RiskFactorContribution | undefined {
  return factors.filter((f) => f.direction === "negative").sort((a, b) => b.impact - a.impact)[0];
}

/** Plain-language explanation of the risk score, built from the actual
 * factor breakdown. */
export function explainRiskFactors(result: FullAssessmentResult): string[] {
  const { risk } = result;
  const lines: string[] = [];
  const negatives = risk.factors.filter((f) => f.direction === "negative").sort((a, b) => b.impact - a.impact);
  const positives = risk.factors.filter((f) => f.direction === "positive").sort((a, b) => a.impact - b.impact);

  if (negatives[0]) {
    lines.push(tr("{factor} adds the most to your score: {points} points. {description}", { factor: negatives[0].name, points: negatives[0].impact.toFixed(1), description: negatives[0].description }));
  }
  if (negatives[1]) {
    lines.push(tr("{factor} is next, adding {points} points.", { factor: negatives[1].name, points: negatives[1].impact.toFixed(1) }));
  }
  if (positives[0]) {
    lines.push(tr("{factor} takes {points} points off. {description}", { factor: positives[0].name, points: Math.abs(positives[0].impact).toFixed(1), description: positives[0].description }));
  }
  if (negatives.length === 0) {
    lines.push(tr("Nothing in your answers is pushing your score up."));
  }
  const score = risk.riskScore;
  const overall: Record<string, string> = {
    "Very Low": tr("Overall you score {score} out of 100, which is very low risk for this type of cover.", { score }),
    Low: tr("Overall you score {score} out of 100, which is low risk for this type of cover.", { score }),
    Moderate: tr("Overall you score {score} out of 100, which is moderate risk for this type of cover.", { score }),
    High: tr("Overall you score {score} out of 100, which is high risk for this type of cover.", { score }),
    "Very High": tr("Overall you score {score} out of 100, which is very high risk for this type of cover.", { score }),
  };
  lines.push(overall[risk.riskCategory] ?? `Overall you score ${risk.riskScore} out of 100, which is ${risk.riskCategory.toLowerCase()} risk for this type of cover.`);
  return lines;
}

/** Answers the six preset questions from the applicant's own assessment. */
export function answerAdvisorQuestion(questionId: AdvisorQuestionId, result: FullAssessmentResult): string {
  const { risk, premium, recommendations, fraud } = result;
  const biggest = topNegative(risk.factors);
  const topRec = recommendations[0];
  const second = risk.factors.filter((f) => f.direction === "negative").sort((a, b) => b.impact - a.impact)[1];

  switch (questionId) {
    case "WHY_PREMIUM_HIGH": {
      const fixed = premium.fixedPremium > 0 ? " " + tr("{amount} of it is third-party cover, which IRDAI fixes by engine size and nobody can discount.", { amount: fmtInr(premium.fixedPremium) }) : "";
      const score = risk.riskScore;
      if (risk.riskScore < 40) {
        // Scores under 40 are always "Very Low" (<=20) or "Low" (see categorizeRiskScore).
        const amount = fmtInr(premium.finalPremium);
        const low = risk.riskCategory === "Very Low"
          ? tr("Your risk is very low ({score}/100), so risk isn't what's driving the {amount}. Most of it comes from the base rate for this cover and the amount insured.", { score, amount })
          : tr("Your risk is low ({score}/100), so risk isn't what's driving the {amount}. Most of it comes from the base rate for this cover and the amount insured.", { score, amount });
        return low + fixed;
      }
      const v = { score, multiplier: premium.riskMultiplier, claims: premium.claimHistoryFactor, city: premium.locationFactor };
      const body = biggest
        ? tr("Your risk score of {score}/100 multiplies the base price by {multiplier}×. The biggest reason is {factor} (+{points} points). Your claim history ({claims}×) and city ({city}×) add to it.", { ...v, factor: biggest.name.toLowerCase(), points: biggest.impact.toFixed(1) })
        : tr("Your risk score of {score}/100 multiplies the base price by {multiplier}×. The biggest reason is a mix of smaller factors. Your claim history ({claims}×) and city ({city}×) add to it.", v);
      return body + fixed;
    }
    case "HOW_TO_REDUCE": {
      if (!topRec) return tr("None of the changes this tool can model would lower your premium noticeably. Your best move is comparing real quotes.");
      const v = { title: topRec.title, amount: fmtInr(topRec.estimatedSavingAmount), percent: topRec.estimatedSavingPercent, description: topRec.description };
      if (topRec.effort === "Low") return tr("{title}. That would save about {amount} a year ({percent}%), and it's low effort. {description}", v);
      if (topRec.effort === "Medium") return tr("{title}. That would save about {amount} a year ({percent}%), and it's medium effort. {description}", v);
      return tr("{title}. That would save about {amount} a year ({percent}%), and it's high effort. {description}", v);
    }
    case "BIGGEST_RISK": {
      if (!biggest) return tr("No single factor stands out. Your score comes from several small ones.");
      return tr("{factor}. It adds {points} of your {score} points. {description}", { factor: biggest.name, points: biggest.impact.toFixed(1), score: risk.riskScore, description: biggest.description });
    }
    case "WHICH_FACTOR_MOST": {
      if (!biggest) return tr("No single factor stands out. Your score comes from several small ones.");
      if (second) return tr("{factor} has the largest effect (+{points} points), followed by {second} (+{secondPoints}).", { factor: biggest.name, points: biggest.impact.toFixed(1), second: second.name.toLowerCase(), secondPoints: second.impact.toFixed(1) });
      return tr("{factor} has the largest effect (+{points} points).", { factor: biggest.name, points: biggest.impact.toFixed(1) });
    }
    case "WHAT_SAVES_MOST": {
      if (!topRec) return tr("None of the changes this tool can model would save a meaningful amount.");
      const ranked = [...recommendations].sort((a, b) => b.estimatedSavingAmount - a.estimatedSavingAmount).slice(0, 3);
      return tr("By amount saved: {list}.", { list: ranked.map((r) => `${r.title.toLowerCase()} (${fmtInr(r.estimatedSavingAmount)})`).join(", ") });
    }
    case "WHAT_TO_IMPROVE_FIRST": {
      if (!topRec) return tr("Nothing obvious. Keeping a claim-free record will do the most over time.");
      const note = fraud.fraudScore > 40 ? " " + tr("Also double-check your answers: some of them look unusual, and an insurer would ask about them.") : "";
      const v = { title: topRec.title.toLowerCase(), amount: fmtInr(topRec.estimatedSavingAmount) };
      const start = topRec.effort === "Low"
        ? tr("Start with: {title}. It gives the most saving for the effort ({amount} a year, low effort).", v)
        : topRec.effort === "Medium"
          ? tr("Start with: {title}. It gives the most saving for the effort ({amount} a year, medium effort).", v)
          : tr("Start with: {title}. It gives the most saving for the effort ({amount} a year, high effort).", v);
      return start + note;
    }
  }
}
