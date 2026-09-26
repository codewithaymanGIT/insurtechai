import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { HeartPulse, Car, Home, Umbrella, ArrowRight, Check } from "lucide-react";
import { LOCATIONS, VEHICLE_AGE_STEPS, clampClaimFreeYears, depreciationFor, idvFromExShowroom, ncbFor, vehicleAgeStep } from "@insurtechai/shared";
import type { ApplicantProfile, InsuranceType } from "@insurtechai/shared";
import { PageHeader } from "../../components/shell/AppShell";
import { Panel, Callout } from "../../components/ui/Primitives";
import { Button } from "../../components/ui/Button";
import { Input, Field } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { SwitchRow, Stepper, Segmented } from "../../components/ui/Controls";
import { defaultApplicant } from "../../lib/defaults";
import { api, ApiError } from "../../lib/api";
import { useAssessment } from "../../context/AssessmentContext";
import { useAuth } from "../../context/AuthContext";
import { gsap, useGSAP, reducedMotion } from "../../lib/motion";
import { cn, inr, inrWords, num } from "../../lib/utils";
import { useI18n } from "../../context/I18nContext";

const TYPES: { value: InsuranceType; label: string; line: string; icon: typeof Car }[] = [
  { value: "HEALTH", label: "Health", line: "Hospital bills for you or your family", icon: HeartPulse },
  { value: "MOTOR", label: "Motor", line: "Car or two-wheeler", icon: Car },
  { value: "PROPERTY", label: "Home", line: "The structure of your house or flat", icon: Home },
  { value: "LIFE", label: "Term life", line: "A payout for your family if you die", icon: Umbrella },
];

const CITY_OPTIONS = LOCATIONS.map((l) => ({ value: l, label: l }));
const AGE_LABEL: Record<number, string> = {
  0: "Under 6 months",
  0.5: "6 to 12 months",
  1: "1 to 2 years",
  2: "2 to 3 years",
  3: "3 to 4 years",
  4: "4 to 5 years",
  5: "Over 5 years",
};
const CONDITIONS = ["Diabetes", "Hypertension", "Heart disease", "Asthma", "Thyroid", "Kidney disease"];
const FAMILY = ["Diabetes", "Heart disease", "Cancer", "Hypertension", "Stroke"];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Panel id={id} className="scroll-mt-20" data-section>
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
      </div>
      <div className="grid gap-x-5 gap-y-4 p-5 sm:grid-cols-2">{children}</div>
    </Panel>
  );
}

function MoneyInput({ id, value, onChange, min }: { id: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      prefix="₹"
      value={Number.isFinite(value) ? num(value) : ""}
      min={min}
      onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
      onFocus={(e) => e.target.select()}
    />
  );
}

function NumberInput({ id, value, onChange, suffix, step }: { id: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number }) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      step={step}
      suffix={suffix}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
    />
  );
}

function Chips({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs transition-colors",
              on ? "border-accent/50 bg-accent/10 text-fg" : "border-border-strong bg-surface text-fg-muted hover:text-fg",
            )}
          >
            {on && <Check className="size-3 text-accent-text" />}
            {t(o)}
          </button>
        );
      })}
    </div>
  );
}

export function NewEstimate() {
  const navigate = useNavigate();
  const { setAssessment, applicant: previous } = useAssessment();
  const { user } = useAuth();
  const { t } = useI18n();
  const [type, setType] = useState<InsuranceType>(previous?.policy.insuranceType ?? "MOTOR");
  const [a, setA] = useState<ApplicantProfile>(() => previous ?? defaultApplicant("MOTOR"));
  const [height, setHeight] = useState(170);
  // Coming back to edit a health estimate: recover a weight that reproduces the saved BMI.
  const [weight, setWeight] = useState(() => (previous?.health ? Math.round(previous.health.bmi * 1.7 * 1.7) : 70));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.from("[data-section]", { opacity: 0, y: 10, duration: 0.45, stagger: 0.06, ease: "power2.out" });
    },
    { scope: root, dependencies: [type] },
  );

  const ageStep = a.motor ? vehicleAgeStep(a.motor.vehicleAgeYears) : 0;
  const dep = a.motor ? depreciationFor(ageStep) : null;
  // No ex-showroom price (e.g. an IDV set by hand on the What-if page): use the IDV as entered.
  const scheduled = !!dep && a.motor?.exShowroomPrice !== undefined;
  const idv = a.motor && dep ? idvFromExShowroom(a.motor.exShowroomPrice ?? 0, ageStep) : null;

  const bmi = useMemo(() => (height > 0 ? +(weight / (height / 100) ** 2).toFixed(1) : NaN), [height, weight]);

  function pickType(next: InsuranceType) {
    if (next === type) return;
    setType(next);
    setA(defaultApplicant(next, a.personal));
    setError(null);
    setFieldErrors({});
  }

  function set<K extends "personal" | "health" | "motor" | "property" | "life" | "policy">(key: K, patch: Partial<NonNullable<ApplicantProfile[K]>>) {
    setA((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } }));
  }

  const err = (path: string) => fieldErrors[path];

  async function submit() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    let payload: ApplicantProfile = type === "HEALTH" && a.health ? { ...a, health: { ...a.health, bmi } } : a;
    if (payload.motor) {
      // Up to 5 years the IDV comes from the ex-showroom price; over 5 it's what the person entered.
      const m = { ...payload.motor, vehicleAgeYears: ageStep, claimFreeYears: clampClaimFreeYears(payload.motor.claimFreeYears) };
      if (scheduled && idv) m.vehicleValue = idv;
      else delete m.exShowroomPrice;
      payload = { ...payload, motor: m };
    }
    if (type === "LIFE") payload.policy = { ...payload.policy, deductible: 0 };
    try {
      const result = await api.estimate(payload);
      setAssessment(payload, result);
      navigate("/estimate");
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        setError(Object.keys(e.fieldErrors).length ? t("Some answers need fixing. They're highlighted below.") : e.message);
      } else {
        setError(t("Something went wrong. Please try again."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const words = (n: number) => inrWords(n) ?? undefined;

  return (
    <div ref={root}>
      <PageHeader title={t("New estimate")} description={t("A few questions about you and what you want to insure. Only the ones that affect this type of cover are shown.")} />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-8 sm:py-8">
        <div data-section className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("Type of cover")}>
          {TYPES.map((c) => {
            const active = c.value === type;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickType(c.value)}
                className={cn(
                  "group flex flex-col gap-3 rounded-lg border p-3.5 text-left transition-[border-color,background-color]",
                  active ? "border-accent/60 bg-accent/[0.06]" : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <c.icon className={cn("size-[18px]", active ? "text-accent-text" : "text-fg-subtle group-hover:text-fg-muted")} />
                <span>
                  <span className="block text-sm font-medium text-fg">{t(c.label)}</span>
                  <span className="mt-0.5 block text-2xs leading-4 text-fg-subtle">{t(c.line)}</span>
                </span>
              </button>
            );
          })}
        </div>

        <Section id="you" title={t("About you")}>
          <Field label={t("Age")} error={err("personal.age")}>
            {(id) => <NumberInput id={id} value={a.personal.age} onChange={(v) => set("personal", { age: v })} suffix={t("years")} />}
          </Field>
          <Field label={t("City")} error={err("personal.location")}>
            {(id) => <Select id={id} value={a.personal.location} onChange={(v) => set("personal", { location: v })} options={CITY_OPTIONS} />}
          </Field>
          <Field label={t("Annual income")} hint={words(a.personal.annualIncome)} error={err("personal.annualIncome")}>
            {(id) => <MoneyInput id={id} value={a.personal.annualIncome} onChange={(v) => set("personal", { annualIncome: v })} />}
          </Field>
          <Field label={t("People who depend on you financially")} hint={t("Spouse, children or parents you support")} error={err("personal.dependents")}>
            {(id) => <Stepper id={id} value={a.personal.dependents} onChange={(v) => set("personal", { dependents: v })} max={15} />}
          </Field>
          {type === "LIFE" && (
            <Field label={t("Sex")} hint={t("Only used to pick the matching published rate table for the market comparison. It doesn't change your estimate.")}>
              {(id) => (
                <Select
                  id={id}
                  value={a.personal.gender}
                  onChange={(v) => set("personal", { gender: v })}
                  options={[
                    { value: "MALE", label: t("Male") },
                    { value: "FEMALE", label: t("Female") },
                    { value: "OTHER", label: t("Prefer not to say") },
                  ]}
                />
              )}
            </Field>
          )}
        </Section>

        {type === "MOTOR" && a.motor && (
          <Section id="vehicle" title={t("Your vehicle")} description={t("For vehicles up to 5 years old, the insured value (IDV) is set by a fixed depreciation schedule, so we work it out from the ex-showroom price.")}>
            <Field label={t("Vehicle type")} className="sm:col-span-2">
              {() => (
                <Segmented
                  aria-label={t("Vehicle type")}
                  className="w-full flex-wrap"
                  value={a.motor!.vehicleType}
                  onChange={(v) =>
                    set("motor", {
                      vehicleType: v,
                      ...(v === "TWO_WHEELER" ? { engineCapacityCC: 150, exShowroomPrice: 110000, vehicleValue: 66000 } : a.motor!.vehicleType === "TWO_WHEELER" ? { engineCapacityCC: 1200, exShowroomPrice: 1000000, vehicleValue: 600000 } : {}),
                    })
                  }
                  options={[
                    { value: "TWO_WHEELER", label: t("2-wheeler") },
                    { value: "HATCHBACK", label: t("Hatchback") },
                    { value: "SEDAN", label: t("Sedan") },
                    { value: "SUV", label: t("SUV") },
                    { value: "COMMERCIAL", label: t("Commercial") },
                  ]}
                />
              )}
            </Field>
            <Field label={t("Vehicle age")} hint={t("From the date of first registration")} error={err("motor.vehicleAgeYears")}>
              {(id) => (
                <Select
                  id={id}
                  value={String(ageStep)}
                  onChange={(v) => set("motor", { vehicleAgeYears: Number(v) })}
                  options={VEHICLE_AGE_STEPS.map((s) => ({ value: String(s), label: t(AGE_LABEL[s]) }))}
                />
              )}
            </Field>
            {scheduled ? (
              <Field label={t("Ex-showroom price when new")} hint={words(a.motor.exShowroomPrice ?? 0)} error={err("motor.exShowroomPrice")}>
                {(id) => <MoneyInput id={id} value={a.motor!.exShowroomPrice ?? 0} onChange={(v) => set("motor", { exShowroomPrice: v })} />}
              </Field>
            ) : (
              <Field label={t("Insured value (IDV)")} hint={dep ? t("IDV entered by you") : t("Over 5 years there is no fixed schedule. Use the IDV on your current policy.")} error={err("motor.vehicleValue")}>
                {(id) => <MoneyInput id={id} value={a.motor!.vehicleValue} onChange={(v) => set("motor", { vehicleValue: v })} />}
              </Field>
            )}
            {scheduled && dep && (
              <div className="rounded-md border border-border bg-surface-2/50 px-3 py-2.5 sm:col-span-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs text-fg-muted">{t("Insured value (IDV)")}</span>
                  <span className="num text-sm font-medium text-fg">{idv ? inr(idv) : "—"}</span>
                </div>
                <p className="mt-1 text-2xs text-fg-subtle">
                  {t("Ex-showroom price minus {pct}% depreciation for a vehicle aged {band}.", { pct: dep.percent, band: t(dep.band).toLowerCase() })}
                </p>
              </div>
            )}
            <Field
              label={t("Years in a row without a claim")}
              hint={t("No-claim bonus: {pct}% off the own-damage premium", { pct: ncbFor(a.motor.claimFreeYears) })}
              error={err("motor.claimFreeYears")}
            >
              {(id) => (
                <Select
                  id={id}
                  value={String(clampClaimFreeYears(a.motor!.claimFreeYears))}
                  onChange={(v) => set("motor", { claimFreeYears: Number(v) })}
                  options={[0, 1, 2, 3, 4, 5].map((y) => ({
                    value: String(y),
                    label: y === 0 ? t("None, or I claimed last year") : y === 5 ? t("5 or more") : String(y),
                    hint: `${ncbFor(y)}%`,
                  }))}
                />
              )}
            </Field>
            <Field label={t("Engine size")} hint={t("Sets the third-party premium")} error={err("motor.engineCapacityCC")}>
              {(id) => <NumberInput id={id} value={a.motor!.engineCapacityCC} onChange={(v) => set("motor", { engineCapacityCC: v })} suffix="cc" />}
            </Field>
            <Field label={t("Distance driven a year")} error={err("motor.annualMileageKm")}>
              {(id) => <NumberInput id={id} value={a.motor!.annualMileageKm} onChange={(v) => set("motor", { annualMileageKm: v })} suffix="km" step={500} />}
            </Field>
            <Field label={t("Years of driving")} error={err("motor.drivingExperienceYears")}>
              {(id) => <NumberInput id={id} value={a.motor!.drivingExperienceYears} onChange={(v) => set("motor", { drivingExperienceYears: v })} suffix={t("years")} />}
            </Field>
            <Field label={t("Accidents you've had")} error={err("motor.previousAccidents")}>
              {(id) => <Stepper id={id} value={a.motor!.previousAccidents} onChange={(v) => set("motor", { previousAccidents: v })} />}
            </Field>
            <Field label={t("Claims you've made")} error={err("motor.previousClaims")}>
              {(id) => <Stepper id={id} value={a.motor!.previousClaims} onChange={(v) => set("motor", { previousClaims: v })} />}
            </Field>
            <Field label={t("Traffic challans")} error={err("motor.trafficViolations")}>
              {(id) => <Stepper id={id} value={a.motor!.trafficViolations} onChange={(v) => set("motor", { trafficViolations: v })} max={50} />}
            </Field>
            <div className="sm:col-span-2">
              <SwitchRow
                label={t("ARAI-approved anti-theft device fitted")}
                hint={t("Most insurers give a small discount for one")}
                checked={a.motor.hasTrackingDevice}
                onChange={(v) => set("motor", { hasTrackingDevice: v })}
              />
            </div>
          </Section>
        )}

        {type === "HEALTH" && a.health && (
          <Section id="health" title={t("Your health")} description={t("Insurers ask these on the proposal form. Answering honestly here gives a more realistic number.")}>
            <Field label={t("Height")} error={err("health.bmi")}>
              {(id) => <NumberInput id={id} value={height} onChange={setHeight} suffix="cm" />}
            </Field>
            <Field
              label={t("Weight")}
              hint={Number.isFinite(bmi) ? `BMI ${bmi} · ${bmi >= 30 ? t("obese range") : bmi >= 25 ? t("overweight range") : bmi < 18.5 ? t("underweight range") : t("healthy range")}` : undefined}
            >
              {(id) => <NumberInput id={id} value={weight} onChange={setWeight} suffix="kg" />}
            </Field>
            <Field label={t("Alcohol")}>
              {(id) => (
                <Select
                  id={id}
                  value={a.health!.alcoholUse}
                  onChange={(v) => set("health", { alcoholUse: v })}
                  options={[
                    { value: "NONE", label: t("Never") },
                    { value: "OCCASIONAL", label: t("Occasionally") },
                    { value: "MODERATE", label: t("A few times a week") },
                    { value: "HEAVY", label: t("Most days") },
                  ]}
                />
              )}
            </Field>
            <Field label={t("Exercise")}>
              {(id) => (
                <Select
                  id={id}
                  value={a.health!.exerciseFrequency}
                  onChange={(v) => set("health", { exerciseFrequency: v })}
                  options={[
                    { value: "NONE", label: t("Rarely or never") },
                    { value: "OCCASIONAL", label: t("Once or twice a week") },
                    { value: "REGULAR", label: t("Three or more times a week") },
                    { value: "ATHLETE", label: t("Trains most days") },
                  ]}
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <SwitchRow label={t("I smoke or use tobacco")} checked={a.health.smoker} onChange={(v) => set("health", { smoker: v })} />
            </div>
            <Field label={t("Conditions you've been diagnosed with")} className="sm:col-span-2" hint={t("Leave all off if none")}>
              {() => <Chips label={t("Diagnosed conditions")} options={CONDITIONS} value={a.health!.existingConditions} onChange={(v) => set("health", { existingConditions: v })} />}
            </Field>
            <Field label={t("Conditions in your parents or siblings")} className="sm:col-span-2">
              {() => <Chips label={t("Family history")} options={FAMILY} value={a.health!.familyMedicalHistory} onChange={(v) => set("health", { familyMedicalHistory: v })} />}
            </Field>
          </Section>
        )}

        {type === "PROPERTY" && a.property && (
          <Section id="home" title={t("Your home")} description={t("Home insurance covers the building. Use the rebuilding cost, not the market price with land.")}>
            <Field label={t("Rebuilding value")} hint={words(a.property.propertyValue)} error={err("property.propertyValue")}>
              {(id) => <MoneyInput id={id} value={a.property!.propertyValue} onChange={(v) => set("property", { propertyValue: v })} />}
            </Field>
            <Field label={t("Age of the building")} error={err("property.propertyAgeYears")}>
              {(id) => <NumberInput id={id} value={a.property!.propertyAgeYears} onChange={(v) => set("property", { propertyAgeYears: v })} suffix={t("years")} />}
            </Field>
            <Field label={t("Construction")}>
              {(id) => (
                <Select
                  id={id}
                  value={a.property!.constructionType}
                  onChange={(v) => set("property", { constructionType: v })}
                  options={[
                    { value: "RCC_CONCRETE", label: t("Reinforced concrete (RCC)") },
                    { value: "BRICK_MASONRY", label: t("Brick and mortar") },
                    { value: "PREFAB", label: t("Prefabricated") },
                    { value: "WOODEN", label: t("Wood") },
                    { value: "OTHER", label: t("Other") },
                  ]}
                />
              )}
            </Field>
            <Field label={t("Previous claims on this home")}>
              {(id) => <Stepper id={id} value={a.property!.previousClaims} onChange={(v) => set("property", { previousClaims: v })} />}
            </Field>
            <div className="grid gap-2 sm:col-span-2">
              <SwitchRow label={t("Alarm or monitored CCTV")} checked={a.property.hasSecuritySystem} onChange={(v) => set("property", { hasSecuritySystem: v })} />
              <SwitchRow label={t("Area has flooded before")} checked={a.property.floodRiskZone} onChange={(v) => set("property", { floodRiskZone: v })} />
              <SwitchRow label={t("Near a fire hazard")} hint={t("For example a factory, godown or fuel station next door")} checked={a.property.fireRiskZone} onChange={(v) => set("property", { fireRiskZone: v })} />
              <SwitchRow label={t("High earthquake or cyclone zone")} hint={t("Seismic zone IV–V, or a cyclone-prone coast")} checked={a.property.disasterExposureZone} onChange={(v) => set("property", { disasterExposureZone: v })} />
            </div>
          </Section>
        )}

        {type === "LIFE" && a.life && (
          <Section id="life" title={t("Your cover")} description={t("Term insurance pays a fixed amount to your family if you die during the term. It has no maturity payout.")}>
            <Field label={t("Cover amount")} hint={words(a.life.coverageAmount)} error={err("life.coverageAmount")}>
              {(id) => <MoneyInput id={id} value={a.life!.coverageAmount} onChange={(v) => set("life", { coverageAmount: v })} />}
            </Field>
            <Field label={t("Term")} error={err("life.policyTermYears")}>
              {(id) => (
                <Select
                  id={id}
                  value={String(a.life!.policyTermYears)}
                  onChange={(v) => set("life", { policyTermYears: Number(v) })}
                  options={[10, 15, 20, 25, 30, 35, 40].map((y) => ({ value: String(y), label: t("{n} years", { n: y }), hint: t("to age {age}", { age: a.personal.age + y }) }))}
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-1.5 sm:col-span-2">
              {[5000000, 10000000, 15000000, 20000000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set("life", { coverageAmount: v })}
                  className={cn(
                    "h-7 rounded-md border px-2.5 text-xs transition-colors",
                    a.life!.coverageAmount === v ? "border-accent/50 bg-accent/10 text-fg" : "border-border-strong text-fg-muted hover:text-fg",
                  )}
                >
                  {inrWords(v)}
                </button>
              ))}
              <span className="self-center text-2xs text-fg-subtle">
                {a.personal.annualIncome > 0 && t("{x}× your income", { x: (a.life.coverageAmount / a.personal.annualIncome).toFixed(1) })}
              </span>
            </div>
            <Field label={t("Job risk")} className="sm:col-span-2">
              {(id) => (
                <Select
                  id={id}
                  value={a.life!.occupationRiskClass}
                  onChange={(v) => set("life", { occupationRiskClass: v })}
                  options={[
                    { value: "LOW", label: t("Low"), hint: t("office, teaching, IT") },
                    { value: "MEDIUM", label: t("Medium"), hint: t("field sales, driving, site work") },
                    { value: "HIGH", label: t("High"), hint: t("mining, offshore, armed forces, aviation") },
                  ]}
                />
              )}
            </Field>
            <div className="grid gap-2 sm:col-span-2">
              <SwitchRow label={t("I smoke or use tobacco")} hint={t("Including occasional use in the last 12 months")} checked={a.life.smoker} onChange={(v) => set("life", { smoker: v })} />
              <SwitchRow label={t("I have a diagnosed medical condition")} hint={t("Diabetes, blood pressure, heart or other long-term conditions")} checked={a.life.preExistingConditions} onChange={(v) => set("life", { preExistingConditions: v })} />
            </div>
          </Section>
        )}

        <Section id="policy" title={t("Policy")}>
          <Field label={t("Cover level")} hint={type === "LIFE" ? t("Riders such as accidental death or critical illness") : t("Add-ons such as zero depreciation or room-rent waiver")}>
            {(id) => (
              <Select
                id={id}
                value={a.policy.coverageLevel}
                onChange={(v) => set("policy", { coverageLevel: v })}
                options={[
                  { value: "BASIC", label: t("Basic") },
                  { value: "STANDARD", label: t("Standard") },
                  { value: "PREMIUM", label: t("Premium") },
                  { value: "COMPREHENSIVE", label: t("Comprehensive") },
                ]}
              />
            )}
          </Field>
          {type !== "LIFE" && (
            <Field label={t("Voluntary deductible")} hint={t("The part of each claim you pay yourself")} error={err("policy.deductible")}>
              {(id) => <MoneyInput id={id} value={a.policy.deductible} onChange={(v) => set("policy", { deductible: v })} />}
            </Field>
          )}
          <Field label={t("Insurance claims in the last 12 months")} hint={t("Across any policy you hold")}>
            {(id) => <Stepper id={id} value={a.claimsLast12Months ?? 0} onChange={(v) => setA((p) => ({ ...p, claimsLast12Months: v }))} max={50} />}
          </Field>
        </Section>

        {error && <Callout tone="danger">{error}</Callout>}

        <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-bg/90 px-4 py-4 backdrop-blur-xl sm:-mx-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs text-fg-subtle">
            {user ? t("This estimate will be saved to your account.") : t("Nothing is stored unless you sign in.")}
          </p>
          <Button variant="primary" size="lg" onClick={submit} loading={submitting} className="sm:w-auto">
            {t("See my estimate")} <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
