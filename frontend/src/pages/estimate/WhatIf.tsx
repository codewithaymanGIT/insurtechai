import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import type { ApplicantProfile, ScenarioSimulationResult, CoverageLevel } from "@insurtechai/shared";
import { clampClaimFreeYears, ncbFor } from "@insurtechai/shared";
import { PageHeader } from "../../components/shell/AppShell";
import { Panel, PanelHeader, Tag, Eyebrow } from "../../components/ui/Primitives";
import { Button } from "../../components/ui/Button";
import { Slider, Switch, Segmented } from "../../components/ui/Controls";
import { CountUp } from "../../components/ui/CountUp";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyEstimate } from "../../components/estimate/EmptyEstimate";
import { useAssessment } from "../../context/AssessmentContext";
import { useT } from "../../context/I18nContext";
import { api, ApiError } from "../../lib/api";
import { COVER_LABEL, RISK_TONE, cn, inr, inrWords, num } from "../../lib/utils";

function Control({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-b border-border/60 px-4 py-4 last:border-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm text-fg">{label}</p>
        {value !== undefined && <p className="num font-mono text-xs text-fg-muted">{value}</p>}
      </div>
      {children}
    </div>
  );
}

function ToggleControl({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-border/60 px-4 py-3.5 last:border-0">
      <span>
        <span className="block text-sm text-fg">{label}</span>
        {hint && <span className="block text-2xs text-fg-subtle">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const COVERS: { value: CoverageLevel; label: string }[] = (["BASIC", "STANDARD", "PREMIUM", "COMPREHENSIVE"] as const).map((v) => ({ value: v, label: COVER_LABEL[v] }));

type TFn = (s: string, v?: Record<string, string | number>) => string;

/** Human-readable list of what differs between baseline and scenario. */
function describeChanges(b: ApplicantProfile, m: ApplicantProfile, t: TFn): string[] {
  const out: string[] = [];
  const exercise: Record<string, string> = {
    NONE: t("Exercise: none"),
    OCCASIONAL: t("Exercise: occasional"),
    REGULAR: t("Exercise: regular"),
    ATHLETE: t("Exercise: athlete"),
  };
  const alcohol: Record<string, string> = {
    NONE: t("Alcohol: none"),
    OCCASIONAL: t("Alcohol: occasional"),
    MODERATE: t("Alcohol: moderate"),
    HEAVY: t("Alcohol: heavy"),
  };
  if (b.policy.deductible !== m.policy.deductible) out.push(t("Deductible {from} → {to}", { from: inr(b.policy.deductible), to: inr(m.policy.deductible) }));
  if (b.policy.coverageLevel !== m.policy.coverageLevel) out.push(t("Cover {from} → {to}", { from: t(COVER_LABEL[b.policy.coverageLevel]), to: t(COVER_LABEL[m.policy.coverageLevel]) }));
  if (b.motor && m.motor) {
    if (b.motor.annualMileageKm !== m.motor.annualMileageKm) out.push(t("{from} → {to} km a year", { from: num(b.motor.annualMileageKm), to: num(m.motor.annualMileageKm) }));
    if (b.motor.hasTrackingDevice !== m.motor.hasTrackingDevice) out.push(m.motor.hasTrackingDevice ? t("Anti-theft device fitted") : t("No anti-theft device"));
    if (ncbFor(b.motor.claimFreeYears) !== ncbFor(m.motor.claimFreeYears)) out.push(t("No-claim bonus {from}% → {to}%", { from: ncbFor(b.motor.claimFreeYears), to: ncbFor(m.motor.claimFreeYears) }));
    if (b.motor.previousClaims !== m.motor.previousClaims) out.push(t("Claims on record {from} → {to}", { from: b.motor.previousClaims, to: m.motor.previousClaims }));
    if (b.motor.vehicleValue !== m.motor.vehicleValue) out.push(t("IDV {from} → {to}", { from: inr(b.motor.vehicleValue), to: inr(m.motor.vehicleValue) }));
  }
  if (b.health && m.health) {
    if (b.health.smoker !== m.health.smoker) out.push(m.health.smoker ? t("Smoker") : t("Quit smoking"));
    if (b.health.exerciseFrequency !== m.health.exerciseFrequency) out.push(exercise[m.health.exerciseFrequency] ?? t("Exercise: {level}", { level: m.health.exerciseFrequency.toLowerCase() }));
    if (b.health.alcoholUse !== m.health.alcoholUse) out.push(alcohol[m.health.alcoholUse] ?? t("Alcohol: {level}", { level: m.health.alcoholUse.toLowerCase() }));
    if (b.health.bmi !== m.health.bmi) out.push(t("BMI {from} → {to}", { from: b.health.bmi, to: m.health.bmi }));
  }
  if (b.life && m.life) {
    if (b.life.coverageAmount !== m.life.coverageAmount) out.push(t("Cover {from} → {to}", { from: String(inrWords(b.life.coverageAmount)), to: String(inrWords(m.life.coverageAmount)) }));
    if (b.life.policyTermYears !== m.life.policyTermYears) out.push(t("Term {from} → {to} years", { from: b.life.policyTermYears, to: m.life.policyTermYears }));
    if (b.life.smoker !== m.life.smoker) out.push(m.life.smoker ? t("Smoker") : t("Quit smoking"));
  }
  if (b.property && m.property) {
    if (b.property.hasSecuritySystem !== m.property.hasSecuritySystem) out.push(m.property.hasSecuritySystem ? t("Security system added") : t("No security system"));
    if (b.property.propertyValue !== m.property.propertyValue) out.push(t("Rebuild value {from} → {to}", { from: String(inrWords(b.property.propertyValue)), to: String(inrWords(m.property.propertyValue)) }));
  }
  if (b.property && m.property && b.property.previousClaims !== m.property.previousClaims) out.push(t("Claims on record {from} → {to}", { from: b.property.previousClaims, to: m.property.previousClaims }));
  if ((b.claimsLast12Months ?? 0) !== (m.claimsLast12Months ?? 0)) out.push(t("Claims before renewal {from} → {to}", { from: b.claimsLast12Months ?? 0, to: m.claimsLast12Months ?? 0 }));
  return out;
}

export function WhatIf() {
  const { applicant: baseline, result, setAssessment } = useAssessment();
  const navigate = useNavigate();
  const t = useT();
  const [m, setM] = useState<ApplicantProfile | null>(baseline);
  const [sim, setSim] = useState<ScenarioSimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    setM(baseline);
  }, [baseline]);

  useEffect(() => {
    if (!baseline || !m) return;
    const id = ++reqId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .simulate(baseline, m)
        .then((r) => id === reqId.current && (setSim(r), setError(null)))
        .catch((e) => id === reqId.current && setError(e instanceof ApiError ? e.message : t("Couldn't recalculate.")))
        .finally(() => id === reqId.current && setLoading(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [baseline, m]);

  const changes = useMemo(() => (baseline && m ? describeChanges(baseline, m, t) : []), [baseline, m, t]);

  if (!baseline || !result) return <EmptyEstimate what={t("The what-if tool starts from your estimate, so get one first.")} />;
  if (!m) return null;

  const patch = (fn: (a: ApplicantProfile) => void) =>
    setM((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  const now = sim?.baseline.premium.finalPremium ?? result.premium.finalPremium;
  const then = sim?.scenario.premium.finalPremium ?? result.premium.finalPremium;
  const delta = then - now;
  const scenarioRisk = sim?.scenario.risk ?? result.risk;

  async function apply() {
    if (!m) return;
    setApplying(true);
    try {
      const fresh = await api.estimate(m);
      setAssessment(m, fresh);
      navigate("/estimate");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Couldn't update the estimate."));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("What-if")}
        description={t("Change something and watch the premium update. Each change is recalculated with the full model, using the rest of your answers as they are.")}
        actions={
          <Button size="md" variant="ghost" onClick={() => setM(baseline)} disabled={changes.length === 0}>
            <RotateCcw /> {t("Reset")}
          </Button>
        }
      />

      <div className="mx-auto grid max-w-page gap-4 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title={t("Policy")} />
            <Control label={t("Cover level")}>
              <Segmented aria-label={t("Cover level")} className="w-full" value={m.policy.coverageLevel} onChange={(v) => patch((a) => void (a.policy.coverageLevel = v))} options={COVERS.map((c) => ({ ...c, label: t(c.label) }))} />
            </Control>
            {!m.life && (
              <Control label={t("Voluntary deductible")} value={inr(m.policy.deductible)}>
                <Slider min={0} max={100000} step={2500} value={[m.policy.deductible]} onValueChange={([v]) => patch((a) => void (a.policy.deductible = v))} />
              </Control>
            )}
            {(m.health || m.life) && (
              <Control label={t("Claims before renewal")} value={m.claimsLast12Months ?? 0}>
                <Slider min={0} max={5} step={1} value={[m.claimsLast12Months ?? 0]} onValueChange={([v]) => patch((a) => void (a.claimsLast12Months = v))} />
              </Control>
            )}
          </Panel>

          {m.motor && (
            <Panel>
              <PanelHeader title={t("Vehicle and driving")} />
              <Control label={t("Distance a year")} value={`${num(m.motor.annualMileageKm)} km`}>
                <Slider min={2000} max={40000} step={1000} value={[m.motor.annualMileageKm]} onValueChange={([v]) => patch((a) => void (a.motor!.annualMileageKm = v))} />
              </Control>
              <Control label={t("Insured value (IDV)")} value={inr(m.motor.vehicleValue)}>
                <Slider
                  min={Math.round(baseline.motor!.vehicleValue * 0.6 / 5000) * 5000}
                  max={Math.round(baseline.motor!.vehicleValue * 1.2 / 5000) * 5000}
                  step={5000}
                  value={[m.motor.vehicleValue]}
                  onValueChange={([v]) =>
                    patch((a) => {
                      // A hand-set IDV replaces the schedule-derived one.
                      a.motor!.vehicleValue = v;
                      delete a.motor!.exShowroomPrice;
                    })
                  }
                />
              </Control>
              <Control label={t("Years in a row without a claim")} value={`${clampClaimFreeYears(m.motor.claimFreeYears)} · NCB ${ncbFor(m.motor.claimFreeYears)}%`}>
                <Slider min={0} max={5} step={1} value={[clampClaimFreeYears(m.motor.claimFreeYears)]} onValueChange={([v]) => patch((a) => void (a.motor!.claimFreeYears = v))} />
              </Control>
              <Control label={t("Claims on record")} value={m.motor.previousClaims}>
                <Slider min={0} max={5} step={1} value={[m.motor.previousClaims]} onValueChange={([v]) => patch((a) => void (a.motor!.previousClaims = v))} />
              </Control>
              <ToggleControl label={t("Anti-theft device fitted")} hint={t("ARAI-approved")} checked={m.motor.hasTrackingDevice} onChange={(v) => patch((a) => void (a.motor!.hasTrackingDevice = v))} />
            </Panel>
          )}

          {m.health && (
            <Panel>
              <PanelHeader title={t("Lifestyle")} />
              <ToggleControl label={t("Smoker")} checked={m.health.smoker} onChange={(v) => patch((a) => void (a.health!.smoker = v))} />
              <Control label={t("Exercise")}>
                <Segmented
                  aria-label={t("Exercise")}
                  className="w-full"
                  value={m.health.exerciseFrequency}
                  onChange={(v) => patch((a) => void (a.health!.exerciseFrequency = v))}
                  options={[
                    { value: "NONE", label: t("Rarely") },
                    { value: "OCCASIONAL", label: t("1–2×/wk") },
                    { value: "REGULAR", label: t("3+×/wk") },
                    { value: "ATHLETE", label: t("Daily") },
                  ]}
                />
              </Control>
              <Control label={t("Alcohol")}>
                <Segmented
                  aria-label={t("Alcohol")}
                  className="w-full"
                  value={m.health.alcoholUse}
                  onChange={(v) => patch((a) => void (a.health!.alcoholUse = v))}
                  options={[
                    { value: "NONE", label: t("Never") },
                    { value: "OCCASIONAL", label: t("Sometimes") },
                    { value: "MODERATE", label: t("Weekly") },
                    { value: "HEAVY", label: t("Daily") },
                  ]}
                />
              </Control>
              <Control label={t("BMI")} value={m.health.bmi.toFixed(1)}>
                <Slider min={17} max={40} step={0.5} value={[m.health.bmi]} onValueChange={([v]) => patch((a) => void (a.health!.bmi = v))} />
              </Control>
            </Panel>
          )}

          {m.life && (
            <Panel>
              <PanelHeader title={t("Cover")} />
              <Control label={t("Cover amount")} value={inrWords(m.life.coverageAmount)}>
                <Slider min={2500000} max={30000000} step={2500000} value={[m.life.coverageAmount]} onValueChange={([v]) => patch((a) => void (a.life!.coverageAmount = v))} />
              </Control>
              <Control label={t("Term")} value={t("{n} years", { n: m.life.policyTermYears })}>
                <Slider min={10} max={40} step={5} value={[m.life.policyTermYears]} onValueChange={([v]) => patch((a) => void (a.life!.policyTermYears = v))} />
              </Control>
              <ToggleControl label={t("Smoker")} checked={m.life.smoker} onChange={(v) => patch((a) => void (a.life!.smoker = v))} />
            </Panel>
          )}

          {m.property && (
            <Panel>
              <PanelHeader title={t("Home")} />
              <Control label={t("Rebuild value")} value={inrWords(m.property.propertyValue)}>
                <Slider
                  min={Math.round(baseline.property!.propertyValue * 0.5 / 100000) * 100000}
                  max={Math.round(baseline.property!.propertyValue * 1.5 / 100000) * 100000}
                  step={100000}
                  value={[m.property.propertyValue]}
                  onValueChange={([v]) => patch((a) => void (a.property!.propertyValue = v))}
                />
              </Control>
              <Control label={t("Claims on record")} value={m.property.previousClaims}>
                <Slider min={0} max={5} step={1} value={[m.property.previousClaims]} onValueChange={([v]) => patch((a) => void (a.property!.previousClaims = v))} />
              </Control>
              <ToggleControl label={t("Alarm or monitored CCTV")} checked={m.property.hasSecuritySystem} onChange={(v) => patch((a) => void (a.property!.hasSecuritySystem = v))} />
            </Panel>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Panel className="overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <div className="p-4">
                <Eyebrow>{t("Now")}</Eyebrow>
                <p className="num mt-2 text-xl font-semibold text-fg-muted">{inr(now)}</p>
                <p className="mt-1 text-2xs text-fg-subtle">{t("Risk {score}", { score: result.risk.riskScore })}</p>
              </div>
              <div className="p-4">
                <Eyebrow className="flex items-center gap-1.5">{t("With changes")} {loading && <Spinner className="size-3" />}</Eyebrow>
                <CountUp value={then} from={now} format={inr} className="num mt-2 block text-xl font-semibold text-fg" />
                <p className="mt-1 text-2xs text-fg-subtle">
                  {t("Risk")} <CountUp value={scenarioRisk.riskScore} from={result.risk.riskScore} format={(n) => String(Math.round(n))} />
                </p>
              </div>
            </div>

            <div className="p-5">
              <div className={cn("flex items-center gap-2", delta < 0 ? "text-positive" : delta > 0 ? "text-warning" : "text-fg-muted")}>
                {delta < 0 ? <TrendingDown className="size-5" /> : delta > 0 ? <TrendingUp className="size-5" /> : null}
                <CountUp
                  value={delta}
                  from={0}
                  format={(n) => (Math.round(n) === 0 ? t("No change") : t("{amount} a year", { amount: `${n < 0 ? "−" : "+"}${inr(Math.abs(n))}` }))}
                  className="num text-2xl font-semibold tracking-[-0.02em]"
                />
              </div>
              {sim && delta !== 0 && (
                <p className="mt-1 text-xs text-fg-subtle">
                  {delta < 0 ? t("{percent}% lower", { percent: Math.abs(sim.premiumSavingsPercent) }) : t("{percent}% higher", { percent: Math.abs(sim.premiumSavingsPercent) })}
                  {sim.riskCategoryChanged && (
                    <>
                      {" · "}{t("risk now")} <Tag tone={RISK_TONE[scenarioRisk.riskCategory]} className="ml-0.5">{t(scenarioRisk.riskCategory)}</Tag>
                    </>
                  )}
                </p>
              )}

              <div className="mt-5">
                <p className="text-2xs font-medium text-fg-subtle">{t("Changes")}</p>
                {changes.length === 0 ? (
                  <p className="mt-1.5 text-sm text-fg-muted">{t("Move a slider or flip a switch to start.")}</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {changes.map((c) => (
                      <li key={c} className="flex gap-2 text-sm text-fg-muted">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && <p className="mt-4 text-xs text-danger">{error}</p>}

              <Button variant="primary" size="lg" className="mt-5 w-full" disabled={changes.length === 0} loading={applying} onClick={apply}>
                {t("Use these answers")} <ArrowRight />
              </Button>
              <p className="mt-2 text-center text-2xs text-fg-subtle">{t("Replaces your current estimate")}</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
