// ============================================================================
// Free-form chat backed by Google Gemini, grounded in the visitor's own
// computed estimate and the cited market ranges in engine/marketBenchmark.ts.
// The six preset questions (engine/advisor.ts) don't use this and work with
// no API key.
//
// Built against Google's published Interactions API docs. If Google changes
// the response shape, parseInteractionText() below is the one place to fix.
// ============================================================================

import { ApplicantProfile, FullAssessmentResult, LANGUAGES } from "@insurtechai/shared";
import { currentLang, tr, N_ } from "../i18n";

const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

// What site visitors see. Technical details (status codes, raw API errors,
// missing-config hints) go to the server console only — never to the browser.
// English source strings; translated with tr() where they are returned.
const USER_MSG_OFFLINE = N_("The assistant is offline right now. The preset questions above still work.");
const USER_MSG_BUSY = N_("The assistant is handling a lot of questions right now. Please try again in a minute.");
const USER_MSG_FAILED = N_("The assistant couldn't answer just now. Please try again in a moment.");

export interface LlmChatResult {
  available: boolean;
  reply: string | null;
  interactionId: string | null;
  error?: string;
}

/** Age as a 5-year band, e.g. 32 -> "30-34". */
function ageBand(age: number): string {
  const lo = Math.floor(age / 5) * 5;
  return `${lo}-${lo + 4}`;
}

/**
 * The context sent to Gemini. Deliberately minimised: no name, email, exact
 * age, income or named medical conditions, because on Gemini's free tier
 * Google may use submitted content to improve its products and human
 * reviewers may read it (Gemini API Additional Terms of Service). What's left
 * is enough to explain the estimate: bands, counts and the computed numbers.
 */
function buildGroundingContext(applicant: ApplicantProfile, result: FullAssessmentResult): string {
  const { risk, premium, fraud, decisionSummary, recommendations } = result;

  const lines: string[] = [];
  lines.push(`Cover: ${applicant.policy.insuranceType}, ${applicant.policy.coverageLevel} level.`);
  lines.push(`Person: age band ${ageBand(applicant.personal.age)}, city ${applicant.personal.location}, ${applicant.personal.dependents} dependent(s).`);
  if (applicant.motor) lines.push(`Vehicle: ${applicant.motor.vehicleType}, ${applicant.motor.engineCapacityCC}cc, ${applicant.motor.vehicleAgeYears} years old, IDV about ₹${Math.round(applicant.motor.vehicleValue / 10000) * 10000}.`);
  if (applicant.life) lines.push(`Term cover: ₹${applicant.life.coverageAmount} for ${applicant.life.policyTermYears} years.`);
  if (applicant.property) lines.push(`Home rebuild value about ₹${Math.round(applicant.property.propertyValue / 100000) * 100000}.`);
  lines.push(`Voluntary deductible: ₹${applicant.policy.deductible}.`);
  lines.push(`Risk score: ${risk.riskScore}/100 (${risk.riskCategory}).`);
  lines.push("Factors behind the score (positive points raise risk):");
  for (const f of risk.factors) {
    // Lifestyle descriptions can name specific conditions; send the factor name only.
    const detail = f.category === "Lifestyle" ? "" : ` (${f.description})`;
    lines.push(`  - ${f.name}: ${f.impact > 0 ? "+" : ""}${f.impact} points${detail}`);
  }
  lines.push(`Estimated premium: ₹${premium.finalPremium}/year before 18% GST = (risk-rated base ₹${premium.basePremium} × risk ${premium.riskMultiplier} × cover ${premium.coverageMultiplier} × city ${premium.locationFactor} × claim history ${premium.claimHistoryFactor} × consistency ${premium.fraudAdjustment} × deductible ${premium.deductibleFactor})${premium.fixedPremium > 0 ? ` + ₹${premium.fixedPremium} ${premium.fixedPremiumLabel}` : ""}.`);
  lines.push(`Consistency flags an insurer might ask about: ${fraud.signals.length > 0 ? fraud.signals.map((s) => s.message).join("; ") : "none"}.`);
  if (decisionSummary.benchmark.applicable) {
    lines.push(`Published market range for similar cover: ₹${decisionSummary.benchmark.lowInr}–₹${decisionSummary.benchmark.highInr} (median ₹${decisionSummary.benchmark.medianInr}); this estimate is ${decisionSummary.benchmark.position} it. ${decisionSummary.benchmark.basis} Sources: ${decisionSummary.benchmark.sources.map((s) => s.label).join("; ") || "none"}.`);
  } else {
    lines.push(`No published market range for this segment: ${decisionSummary.benchmark.basis}`);
  }
  lines.push(`Cover check: ${decisionSummary.coverageAdequacy.message}`);
  if (recommendations.length > 0) {
    lines.push("Changes that would lower the premium, re-run through the model:");
    for (const r of recommendations.slice(0, 5)) {
      lines.push(`  - ${r.title}: saves about ₹${Math.round(r.estimatedSavingAmount)}/year (${r.estimatedSavingPercent}%), ${r.effort.toLowerCase()} effort.`);
    }
  }
  return lines.join("\n");
}

const SYSTEM_PREAMBLE = `You answer questions about one person's insurance estimate on InsurTechAI, an Indian insurance estimate tool. InsurTechAI is not an insurer or broker, and its numbers are estimates, not quotes.

Rules:
1. Base your answer on the data below plus well-established, general knowledge of Indian insurance (IRDAI rules, no-claim bonus, waiting periods, IDV, riders, tax sections). Never invent a specific number, rate or statistic that isn't in the data or widely known.
2. Call the premium "your estimate" or "this estimate". Never present it as a quote or a guaranteed price.
3. Never suggest the person is committing fraud. If consistency flags are present, describe them as things an insurer might ask about.
4. When you use the market range, name its source so the person can check it.
5. If the question has nothing to do with insurance or personal finance, say so in one sentence and suggest what you can help with.
6. Write like a knowledgeable friend: short, direct sentences, specific to this person's numbers. Two short paragraphs at most unless asked for more. No headings, no bullet lists unless the person asks for steps, no em dashes, and no filler openers or closers ("Great question", "I hope this helps").
7. Don't give a buy/don't-buy instruction for a specific product. Explain the trade-off and let the person decide.`;

/** Extra rule telling the model to reply in the visitor's language (none for English). */
function languageRule(): string {
  const lang = LANGUAGES.find((l) => l.code === currentLang());
  if (!lang || lang.code === "en") return "";
  return `\n8. Answer in ${lang.name} (${lang.native}), using simple everyday words; keep insurance terms such as IDV, NCB, deductible and claim settlement ratio in English in brackets the first time.`;
}

export async function askLlmAdvisor(
  applicant: ApplicantProfile,
  result: FullAssessmentResult,
  question: string,
  previousInteractionId?: string,
): Promise<LlmChatResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[llmAdvisor] GEMINI_API_KEY is not set in backend/.env — chat is disabled. Get a free key at https://aistudio.google.com/apikey");
    return { available: false, reply: null, interactionId: null, error: tr(USER_MSG_OFFLINE) };
  }

  const systemInstruction = SYSTEM_PREAMBLE + languageRule() + "\n\nThis person's data:\n" + buildGroundingContext(applicant, result);

  const body: Record<string, unknown> = {
    model: GEMINI_MODEL,
    system_instruction: systemInstruction,
    input: question,
  };
  if (previousInteractionId) body.previous_interaction_id = previousInteractionId;

  try {
    const resp = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      console.error(`[llmAdvisor] Gemini API returned ${resp.status}: ${errText.slice(0, 1000)}`);
      const error = resp.status === 429 ? tr(USER_MSG_BUSY) : tr(USER_MSG_FAILED);
      return { available: false, reply: null, interactionId: null, error };
    }

    const data: unknown = await resp.json();
    const text = parseInteractionText(data);
    if (!text) {
      console.error("[llmAdvisor] Gemini responded but no text could be parsed — response shape may have changed. Raw:", JSON.stringify(data).slice(0, 1000));
      return { available: false, reply: null, interactionId: null, error: tr(USER_MSG_FAILED) };
    }
    const id = (data as { id?: unknown })?.id;
    return { available: true, reply: text, interactionId: typeof id === "string" ? id : null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[llmAdvisor] Could not reach the Gemini API: ${message}`);
    return { available: false, reply: null, interactionId: null, error: tr(USER_MSG_FAILED) };
  }
}

/** The Gemini Interactions API's exact response shape is still evolving
 * (beta endpoint) — this tries the documented `output_text` field first,
 * then falls back to walking `steps[].content[].text`, so a minor shape
 * change doesn't silently break the whole feature. */
function parseInteractionText(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.length > 0) return data.output_text;
  const steps = data?.steps;
  if (Array.isArray(steps)) {
    for (let i = steps.length - 1; i >= 0; i--) {
      const content = steps[i]?.content;
      if (Array.isArray(content)) {
        const textPart = content.find((c: any) => typeof c?.text === "string");
        if (textPart) return textPart.text;
      }
    }
  }
  return null;
}
