import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal, MessageSquare, RotateCcw, ExternalLink, BookmarkCheck, Bookmark, ShieldQuestion, Scale, ArrowRight } from "lucide-react";
import type { MotorValue, TaxBenefit } from "@insurtechai/shared";
import { PageHeader } from "../../components/shell/AppShell";
import { Panel, PanelHeader, Tag, Callout, Eyebrow } from "../../components/ui/Primitives";
import { Button, ButtonLink } from "../../components/ui/Button";
import { CountUp } from "../../components/ui/CountUp";
import { RiskMeter } from "../../components/estimate/RiskMeter";
import { BenchmarkBar } from "../../components/estimate/BenchmarkBar";
import { PremiumLedger } from "../../components/estimate/PremiumLedger";
import { FactorChart } from "../../components/estimate/FactorChart";
import { SavingsTable } from "../../components/estimate/Savings";
import { EmptyEstimate } from "../../components/estimate/EmptyEstimate";
import { useAssessment } from "../../context/AssessmentContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { gsap, useGSAP, reducedMotion } from "../../lib/motion";
import { COVER_LABEL, TYPE_LABEL, inr, RISK_TONE } from "../../lib/utils";
import { useI18n } from "../../context/I18nContext";
import { Spinner } from "../../components/ui/Spinner";

const ADEQUACY: Record<string, { label: string; tone: "positive" | "warning" | "neutral" }> = {
  adequate: { label: "Looks right", tone: "positive" },
  under: { label: "May be too low", tone: "warning" },
  over: { label: "Higher than usual", tone: "neutral" },
  unknown: { label: "Not applicable", tone: "neutral" },
};

const VEHICLE: Record<string, string> = {
  TWO_WHEELER: "Two-wheeler",
  HATCHBACK: "Hatchback",
  SEDAN: "Sedan",
  SUV: "SUV",
  COMMERCIAL: "Commercial",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 p-4">
      <p className="text-2xs text-fg-subtle">{label}</p>
      <p className="num mt-1 text-lg font-semibold text-fg">{value}</p>
      {sub && <p className="mt-0.5 text-2xs text-fg-subtle">{sub}</p>}
    </div>
  );
}

function VehicleValuePanel({ mv }: { mv: MotorValue }) {
  const { t } = useI18n();
  return (
    <Panel data-reveal>
      <PanelHeader
        title={t("Vehicle value and no-claim bonus")}
        description={t("Worked out with the depreciation schedule and NCB slabs insurers use for private vehicles.")}
      />
      <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3">
        <Stat
          label={t("Insured value (IDV)")}
          value={inr(mv.idv)}
          sub={mv.exShowroomPrice && mv.depreciationPercent != null ? t("{price} less {pct}%", { price: inr(mv.exShowroomPrice), pct: mv.depreciationPercent }) : mv.ageBand}
        />
        <Stat label={t("No-claim bonus")} value={`${mv.ncbPercent}%`} sub={t("{n} claim-free years", { n: mv.claimFreeYears })} />
        <div className="max-sm:col-span-2 max-sm:border-t max-sm:border-border">
          <Stat
            label={t("Next renewal without a claim")}
            value={`${mv.nextNcbPercent}%`}
            sub={mv.nextNcbPercent > mv.ncbPercent ? t("Up from {pct}%", { pct: mv.ncbPercent }) : t("Already at the maximum")}
          />
        </div>
      </div>
      <p className="border-t border-border px-4 py-3 text-2xs leading-relaxed text-fg-subtle">
        {t("The NCB belongs to you, not the vehicle, so it moves with you to a new car. A single claim resets it to 0 unless you pay for NCB protection, and it lapses if the policy isn't renewed within 90 days of expiry.")}
      </p>
    </Panel>
  );
}

function TaxPanel({ tax }: { tax: TaxBenefit }) {
  const { t } = useI18n();
  if (!tax.applicable) return null;
  return (
    <Panel data-reveal>
      <PanelHeader
        title={t("Income-tax saving")}
        description={tax.section ?? undefined}
        actions={tax.savedOldRegime > 0 ? <Tag tone="positive" dot>{t("Saves {amount}", { amount: inr(tax.savedOldRegime) })}</Tag> : <Tag>{t("No saving at your income")}</Tag>}
      />
      <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3">
        <Stat label={t("Premium you pay")} value={inr(tax.premiumPaid)} sub={t("Including 18% GST")} />
        <Stat label={t("Deduction")} value={inr(tax.deduction)} sub={tax.limit ? t("Limit {amount}", { amount: inr(tax.limit) }) : undefined} />
        <div className="max-sm:col-span-2 max-sm:border-t max-sm:border-border">
          <Stat
            label={t("Tax saved, old regime")}
            value={inr(tax.savedOldRegime)}
            sub={tax.marginalRatePercent > 0 ? t("At a {pct}% marginal rate incl. cess", { pct: tax.marginalRatePercent }) : undefined}
          />
        </div>
      </div>
      <ul className="space-y-1.5 border-t border-border px-4 py-3">
        {tax.notes.map((n) => (
          <li key={n} className="flex gap-2 text-2xs leading-relaxed text-fg-subtle">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-fg-subtle/60" />
            {n}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function Estimate() {
  const { applicant, result, setAssessment, refreshing } = useAssessment();
  const { user } = useAuth();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.from("[data-reveal]", { opacity: 0, y: 12, duration: 0.55, stagger: 0.07, ease: "power2.out", delay: 0.05 });
    },
    { scope: root, dependencies: [result?.premium.finalPremium] },
  );

  if (!applicant || !result) return <EmptyEstimate what={t("Answer a few questions and your estimate, market comparison and savings will show up here.")} />;

  const { risk, premium, fraud, recommendations, decisionSummary: ds } = result;
  const adequacy = ADEQUACY[ds.coverageAdequacy.verdict];
  const subject =
    applicant.motor ? `${t(VEHICLE[applicant.motor.vehicleType])}, ${applicant.motor.engineCapacityCC}cc`
    : applicant.life ? t("{amount} for {n} years", { amount: inr(applicant.life.coverageAmount), n: applicant.life.policyTermYears })
    : applicant.property ? t("{amount} rebuild value", { amount: inr(applicant.property.propertyValue) })
    : applicant.personal.dependents >= 2 ? t("Family of {n}", { n: Math.min(applicant.personal.dependents, 4) + 1 }) : t("Individual");

  async function save() {
    if (!applicant) return;
    setSaving(true);
    try {
      const fresh = await api.estimate(applicant);
      setAssessment(applicant, fresh);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={root}>
      <PageHeader
        meta={
          <>
            <Tag>{t(TYPE_LABEL[applicant.policy.insuranceType])}</Tag>
            <Tag>{t("{level} cover", { level: t(COVER_LABEL[applicant.policy.coverageLevel]) })}</Tag>
            <Tag>{applicant.personal.location}</Tag>
            {result.savedId ? (
              <Tag tone="accent"><BookmarkCheck className="size-3" /> {t("Saved")}</Tag>
            ) : null}
            {refreshing && <Spinner className="size-3.5 text-fg-subtle" />}
          </>
        }
        title={subject}
        actions={
          <>
            {user && !result.savedId && (
              <Button size="md" onClick={save} loading={saving}>
                <Bookmark /> {t("Save")}
              </Button>
            )}
            <ButtonLink to="/estimate/new" size="md" variant="ghost"><RotateCcw /> {t("Edit answers")}</ButtonLink>
            <ButtonLink to="/estimate/what-if" size="md"><SlidersHorizontal /> {t("What-if")}</ButtonLink>
            <ButtonLink to="/estimate/ask" size="md" variant="primary"><MessageSquare /> {t("Ask")}</ButtonLink>
          </>
        }
      />

      <div className="mx-auto max-w-page space-y-4 px-4 py-6 sm:px-8 sm:py-8">
        {!user && (
          <div data-reveal>
            <Callout tone="accent" icon={<Bookmark />}>
              <span className="text-fg-muted">{t("This estimate disappears when you close the tab.")} </span>
              <Link to="/signin?next=/estimate" className="font-medium text-accent-text hover:underline">{t("Sign in to save it")}</Link>
            </Callout>
          </div>
        )}

        <Panel data-reveal className="grid overflow-hidden md:grid-cols-[1fr_280px]">
          <div className="p-5 sm:p-6">
            <Eyebrow>{t("Estimated premium")}</Eyebrow>
            <div className="mt-2 flex items-baseline gap-2">
              <CountUp value={premium.finalPremium} format={inr} className="num text-5xl font-semibold tracking-[-0.045em] text-fg max-sm:text-4xl" />
              <span className="text-sm text-fg-subtle">{t("/ year")}</span>
            </div>
            <p className="mt-1 text-xs text-fg-subtle">{t("Before 18% GST · {amount} including GST", { amount: inr(premium.finalPremium * 1.18) })}</p>
            <p className="mt-4 max-w-xl text-md leading-relaxed text-fg-muted text-pretty">{ds.verdict}</p>
            <div className="mt-6 max-w-xl">
              <BenchmarkBar benchmark={ds.benchmark} premium={premium.finalPremium} />
              {ds.benchmark.sources.length > 0 && (
                <p className="mt-2 text-2xs text-fg-subtle">
                  {t("Range from")}{" "}
                  {ds.benchmark.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && ", "}
                      <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-border-strong underline-offset-2 hover:text-fg">
                        {s.label.split(" · ")[0]}
                      </a>
                    </span>
                  ))}
                  . {ds.benchmark.basis}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center border-t border-border bg-bg-subtle/60 p-6 md:border-l md:border-t-0">
            <RiskMeter score={risk.riskScore} category={risk.riskCategory} />
            <p className="mt-1 text-center text-2xs text-fg-subtle">{t("Risk score out of 100 for this type of cover")}</p>
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Panel data-reveal>
            <PanelHeader title={t("How the premium is built")} description={t("Each step multiplies the running total. Orange raises it, blue lowers it.")} />
            <PremiumLedger premium={premium} applicant={applicant} />
          </Panel>

          <div className="space-y-4">
            <Panel data-reveal>
              <PanelHeader title={t("What to do next")} />
              <ol className="space-y-3 p-4">
                {ds.nextSteps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="num mt-px flex size-5 shrink-0 items-center justify-center rounded border border-border-strong font-mono text-[10px] text-fg-muted">{i + 1}</span>
                    <span className="text-fg-muted text-pretty">{s}</span>
                  </li>
                ))}
              </ol>
              {(applicant.policy.insuranceType === "HEALTH" || applicant.policy.insuranceType === "LIFE") && (
                <Link to="/compare" className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-fg-muted transition-colors hover:bg-surface-2/50 hover:text-fg">
                  <Scale className="size-4 text-fg-subtle" />
                  <span className="flex-1">{t("Compare insurers' claim records before you buy")}</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              )}
            </Panel>

            <Panel data-reveal>
              <PanelHeader title={t("Is the cover enough?")} actions={<Tag tone={adequacy.tone} dot>{t(adequacy.label)}</Tag>} />
              <div className="space-y-2 p-4">
                <p className="text-sm text-fg-muted">{ds.coverageAdequacy.message}</p>
                {ds.coverageAdequacy.ruleOfThumb && <p className="text-2xs text-fg-subtle">{ds.coverageAdequacy.ruleOfThumb}</p>}
              </div>
            </Panel>

            <Panel data-reveal>
              <PanelHeader
                title={t("What an insurer may ask about")}
                actions={fraud.signals.length === 0 ? <Tag tone="positive" dot>{t("Nothing unusual")}</Tag> : <Tag tone="warning" dot>{t("{n} to check", { n: fraud.signals.length })}</Tag>}
              />
              <div className="p-4">
                {fraud.signals.length === 0 ? (
                  <p className="text-sm text-fg-muted">{t("Your answers are consistent with each other, so nothing here would stand out to an underwriter.")}</p>
                ) : (
                  <ul className="space-y-2.5">
                    {fraud.signals.map((s) => (
                      <li key={s.code} className="flex gap-2.5 text-sm">
                        <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-warning" />
                        <span className="text-fg-muted">{s.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
          </div>
        </div>

        {(result.motorValue || result.tax.applicable) && (
          <div className={result.motorValue && result.tax.applicable ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
            {result.motorValue && <VehicleValuePanel mv={result.motorValue} />}
            <TaxPanel tax={result.tax} />
          </div>
        )}

        <Panel data-reveal>
          <PanelHeader
            title={t("What moves your risk score")}
            description={t("{score} out of 100. Points on the right push it up, points on the left bring it down.", { score: risk.riskScore })}
            actions={<Tag tone={RISK_TONE[risk.riskCategory]} dot>{t(risk.riskCategory)}</Tag>}
          />
          <FactorChart factors={risk.factors} />
        </Panel>

        <Panel data-reveal>
          <PanelHeader
            title={t("Ways to pay less")}
            description={t("Each change was re-run through the same model, so the savings are specific to you.")}
            actions={<ButtonLink to="/estimate/what-if" size="sm">{t("Try them")} <SlidersHorizontal /></ButtonLink>}
          />
          <SavingsTable items={recommendations} />
        </Panel>

        <p data-reveal className="flex items-center gap-1.5 pt-2 text-2xs text-fg-subtle">
          {t("This is an estimate, not a quote. Insurers price with their own data and medical underwriting.")}
          <Link to="/methodology" className="inline-flex items-center gap-1 underline decoration-border-strong underline-offset-2 hover:text-fg">
            {t("How it's calculated")} <ExternalLink className="size-3" />
          </Link>
        </p>
      </div>
    </div>
  );
}
