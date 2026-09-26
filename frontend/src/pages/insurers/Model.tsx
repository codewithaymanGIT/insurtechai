import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FlaskConical, Info } from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader, PageBody } from "../../components/shell/AppShell";
import { Panel, PanelHeader, Tag, Callout } from "../../components/ui/Primitives";
import { Segmented, Slider } from "../../components/ui/Controls";
import { Select } from "../../components/ui/Select";
import { Field } from "../../components/ui/Input";
import { useT } from "../../context/I18nContext";
import { gsap, useGSAP, reducedMotion } from "../../lib/motion";
import { num, cn } from "../../lib/utils";
import { score, type Policy, type RatingTable } from "../../lib/frequencyModel";
import reportJson from "../../data/frequency-report.json";

// ---------------------------------------------------------------------------
// Report shape (written by ml-service/train.py)
// ---------------------------------------------------------------------------
interface Metrics { deviance: number; devianceExplained: number; gini: number; predictedToActual: number }
interface Report {
  generatedAt: string;
  dataset: { policies: number; exposureYears: number; claims: number; frequency: number; source: string; citation: string };
  split: { trainPolicies: number; testPolicies: number; riskProfiles: number };
  models: { id: "null" | "glm" | "gbm"; name: string; test: Metrics; cv: Record<"deviance" | "devianceExplained" | "gini", { mean: number; sd: number }> }[];
  gbm: { rounds: number; params: Record<string, string | number>; tuning: { num_leaves: number; min_data_in_leaf: number; rounds: number; validDeviance: number }[] };
  lorenz: { x: number[]; null: number[]; glm: number[]; gbm: number[] };
  calibration: Record<"glm" | "gbm", { decile: number; observed: number; predicted: number }[]>;
  doubleLift: { decile: number; observed: number; glm: number; gbm: number }[];
  glm: {
    ratingTable: RatingTable;
    relativities: Record<string, { level?: string; x?: number | string; relativity: number; lo?: number; hi?: number; exposureShare?: number }[]>;
  };
  shap: { sampleSize: number; importance: { feature: string; label: string; meanAbs: number }[]; dependence: Record<string, { x: number; effect: number; n: number }[]> };
}
const report = reportJson as unknown as Report;

const COLOR = { observed: "hsl(var(--fg))", glm: "hsl(var(--risk-1))", gbm: "hsl(var(--accent))", null: "hsl(var(--fg-subtle))" };
const tick = { fontSize: 11, fill: "hsl(var(--fg-subtle))" };
const gridStroke = "hsl(var(--border))";
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

function Tip({ title, rows }: { title: string; rows: [string, string, string?][] }) {
  return (
    <div className="rounded-md bg-surface px-2.5 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-fg">{title}</p>
      {rows.map(([k, v, c]) => (
        <p key={k} className="flex items-center justify-between gap-4 text-fg-muted">
          <span className="flex items-center gap-1.5">{c && <span className="size-2 rounded-sm" style={{ background: c }} />}{k}</span>
          <span className="num text-fg">{v}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: [string, string, boolean?][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-2xs text-fg-muted">
      {items.map(([label, color, dashed]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={cn("h-0.5 w-4 rounded", dashed && "border-t border-dashed bg-transparent")} style={dashed ? { borderColor: color } : { background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="border-t border-border px-4 py-3 text-2xs leading-relaxed text-fg-subtle">{children}</p>;
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------
function LorenzChart() {
  const t = useT();
  const data = report.lorenz.x.map((x, i) => ({ x, glm: report.lorenz.glm[i], gbm: report.lorenz.gbm[i], none: x }));
  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="x" type="number" domain={[0, 1]} tickFormatter={(v) => pct(v, 0)} tick={tick} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => pct(v, 0)} tick={tick} axisLine={false} tickLine={false} />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <Tip
                  title={t("Lowest-risk {pct} of exposure", { pct: pct(payload[0].payload.x, 0) })}
                  rows={[[t("GLM claims share"), pct(payload[0].payload.glm), COLOR.glm], [t("GBM claims share"), pct(payload[0].payload.gbm), COLOR.gbm]]}
                />
              ) : null
            }
          />
          <Line dataKey="none" stroke={COLOR.null} strokeDasharray="4 4" dot={false} strokeWidth={1} isAnimationActive={false} />
          <Line dataKey="glm" stroke={COLOR.glm} dot={false} strokeWidth={2} />
          <Line dataKey="gbm" stroke={COLOR.gbm} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
      <Legend items={[["GLM", COLOR.glm], ["GBM", COLOR.gbm], [t("No model"), COLOR.null, true]]} />
    </>
  );
}

function CalibrationChart({ model }: { model: "glm" | "gbm" }) {
  const t = useT();
  const data = report.calibration[model];
  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="decile" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(2)} />
          <Tooltip
            cursor={{ fill: "hsl(var(--fg) / 0.04)" }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <Tip
                  title={t("Decile {n}", { n: payload[0].payload.decile })}
                  rows={[[t("Observed"), payload[0].payload.observed.toFixed(4), "hsl(var(--fg-subtle))"], [t("Predicted"), payload[0].payload.predicted.toFixed(4), COLOR[model]]]}
                />
              ) : null
            }
          />
          <Bar dataKey="observed" fill="hsl(var(--fg-subtle) / 0.45)" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Line dataKey="predicted" stroke={COLOR[model]} strokeWidth={2} dot={{ r: 3, fill: COLOR[model] }} />
        </ComposedChart>
      </ResponsiveContainer>
      <Legend items={[[t("Observed"), "hsl(var(--fg-subtle))"], [t("Predicted"), COLOR[model]]]} />
    </>
  );
}

function DoubleLiftChart() {
  const t = useT();
  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={report.doubleLift} margin={{ top: 12, right: 16, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="decile" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(2)} />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <Tip
                  title={t("Decile {n}", { n: payload[0].payload.decile })}
                  rows={[
                    [t("Observed"), payload[0].payload.observed.toFixed(4), COLOR.observed],
                    ["GLM", payload[0].payload.glm.toFixed(4), COLOR.glm],
                    ["GBM", payload[0].payload.gbm.toFixed(4), COLOR.gbm],
                  ]}
                />
              ) : null
            }
          />
          <Line dataKey="observed" stroke={COLOR.observed} strokeWidth={2} dot={{ r: 3, fill: COLOR.observed }} />
          <Line dataKey="glm" stroke={COLOR.glm} strokeWidth={2} strokeDasharray="5 3" dot={false} />
          <Line dataKey="gbm" stroke={COLOR.gbm} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <Legend items={[[t("Observed"), COLOR.observed], ["GLM", COLOR.glm, true], ["GBM", COLOR.gbm]]} />
    </>
  );
}

function ImportanceBars() {
  const t = useT();
  const max = report.shap.importance[0].meanAbs;
  return (
    <ul className="space-y-2.5 p-4">
      {report.shap.importance.map((f) => (
        <li key={f.feature} className="grid grid-cols-[130px_1fr_48px] items-center gap-3 text-sm">
          <span className="truncate text-fg-muted">{t(f.label)}</span>
          <span className="h-2 rounded-sm bg-surface-3">
            <span data-bar className="block h-full origin-left rounded-sm bg-accent" style={{ width: `${(f.meanAbs / max) * 100}%` }} />
          </span>
          <span className="num text-right font-mono text-xs text-fg-muted">{f.meanAbs.toFixed(3)}</span>
        </li>
      ))}
    </ul>
  );
}

function EffectChart({ feature, label, glm }: { feature: string; label: string; glm?: { x: number; relativity: number }[] }) {
  const t = useT();
  // With a GLM curve to compare, rescale the SHAP effect to the same reference
  // point (the first value, e.g. bonus-malus 50) so both lines start at ×1.
  const dep = report.shap.dependence[feature];
  const ref = glm ? dep[0].effect : 1;
  const data = dep.map((d) => ({ x: d.x, gbm: d.effect / ref, glm: glm?.find((g) => g.x === d.x)?.relativity }));
  return (
    <div>
      <p className="px-4 pt-3 text-xs font-medium text-fg-muted">{label}</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} scale={feature === "LogDensity" ? "log" : "auto"} tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => num(Math.round(v))} />
          <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => `×${v.toFixed(1)}`} />
          <ReferenceLine y={1} stroke="hsl(var(--border-strong))" />
          <Tooltip content={({ active, payload }) => (active && payload?.[0] ? <Tip title={`${label}: ${num(Math.round(payload[0].payload.x))}`} rows={[[t("GBM effect"), `×${payload[0].payload.gbm.toFixed(2)}`, COLOR.gbm]]} /> : null)} />
          <Line dataKey="gbm" stroke={COLOR.gbm} strokeWidth={2} dot={false} />
          {glm && <Line dataKey="glm" stroke={COLOR.glm} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GLM relativities
// ---------------------------------------------------------------------------
const FACTORS: { id: string; label: string }[] = [
  { id: "DrivAgeBand", label: "Driver age" },
  { id: "VehAgeBand", label: "Vehicle age" },
  { id: "VehPowerCat", label: "Vehicle power" },
  { id: "VehGas", label: "Fuel" },
  { id: "VehBrand", label: "Vehicle brand" },
  { id: "Region", label: "Region" },
];

function Relativities() {
  const t = useT();
  const [factor, setFactor] = useState("DrivAgeBand");
  const rows = report.glm.relativities[factor];
  const max = Math.max(...rows.map((r) => r.hi ?? r.relativity));
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Select size="sm" className="w-[180px]" aria-label={t("Rating factor")} value={factor} onChange={setFactor} options={FACTORS.map((f) => ({ value: f.id, label: t(f.label) }))} />
        <span className="text-2xs text-fg-subtle">{t("Bars show the relativity; the line is the 95% confidence interval.")}</span>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-2xs text-fg-subtle">
              <th className="px-4 py-2 font-medium">{t("Level")}</th>
              <th className="px-4 py-2 font-medium">{t("Relativity")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("Share of exposure")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const base = r.relativity === 1 && r.lo === 1;
              return (
                <tr key={r.level} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 text-fg">
                    {r.level} {base && <Tag className="ml-1">{t("Base")}</Tag>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <span className="num w-12 shrink-0 font-mono text-xs text-fg">{r.relativity.toFixed(2)}</span>
                      <div className="relative h-2 flex-1 rounded-sm bg-surface-3">
                        <span className={cn("absolute inset-y-0 left-0 rounded-sm", r.relativity >= 1 ? "bg-warning/70" : "bg-risk-1/70")} style={{ width: `${(r.relativity / max) * 100}%` }} />
                        {!base && r.lo != null && r.hi != null && (
                          <span className="absolute top-1/2 h-px -translate-y-1/2 bg-fg" style={{ left: `${(r.lo / max) * 100}%`, width: `${((r.hi - r.lo) / max) * 100}%` }} />
                        )}
                        <span className="absolute inset-y-[-3px] w-px bg-fg-subtle" style={{ left: `${(1 / max) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="num px-4 py-2 text-right font-mono text-xs text-fg-muted">{pct(r.exposureShare ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------
const TERM_LABEL: Record<string, string> = {
  DrivAgeBand: "Driver age", VehAgeBand: "Vehicle age", VehPowerCat: "Vehicle power", VehBrand: "Vehicle brand",
  VehGas: "Fuel", Region: "Region", BonusMalus: "Bonus-malus level", Density: "Population density", Area: "Area type",
};

function Calculator() {
  const t = useT();
  const table = report.glm.ratingTable;
  const regions = useMemo(() => Object.keys(table.factors.Region).sort(), [table]);
  const brands = useMemo(() => Object.keys(table.factors.VehBrand).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))), [table]);
  const [p, setP] = useState<Policy>({ DrivAge: 35, VehAge: 5, VehPower: 6, BonusMalus: 50, Density: 300, Area: "C", VehBrand: "B1", VehGas: "Regular", Region: "Centre" });
  const set = (patch: Partial<Policy>) => setP((prev) => ({ ...prev, ...patch }));
  const { frequency, terms } = score(table, p);
  const avg = report.dataset.frequency;

  const slider = (key: keyof Policy, label: string, min: number, max: number, step: number, fmt: (v: number) => string = String) => (
    <Field label={label} aside={<span className="num font-mono text-xs text-fg">{fmt(p[key] as number)}</span>}>
      {() => <Slider min={min} max={max} step={step} value={[p[key] as number]} onValueChange={([v]) => set({ [key]: v } as Partial<Policy>)} />}
    </Field>
  );

  return (
    <div className="grid lg:grid-cols-[1fr_320px]">
      <div className="grid gap-5 p-4 sm:grid-cols-2">
        {slider("DrivAge", t("Driver age"), 18, 90, 1)}
        {slider("BonusMalus", t("Bonus-malus level"), 50, 150, 1)}
        {slider("VehAge", t("Vehicle age"), 0, 20, 1, (v) => t("{n} years", { n: v }))}
        {slider("VehPower", t("Vehicle power"), 4, 15, 1)}
        <Field label={t("Population density")} aside={<span className="num font-mono text-xs text-fg">{num(p.Density)} /km²</span>}>
          {() => <Slider min={0} max={100} step={1} value={[Math.round((Math.log10(p.Density) / Math.log10(27000)) * 100)]} onValueChange={([v]) => set({ Density: Math.max(1, Math.round(10 ** ((v / 100) * Math.log10(27000)))) })} />}
        </Field>
        <Field label={t("Area type")} hint={t("A is rural, F is dense urban")}>
          {() => <Segmented aria-label={t("Area type")} className="w-full" value={p.Area} onChange={(v) => set({ Area: v })} options={(["A", "B", "C", "D", "E", "F"] as const).map((a) => ({ value: a, label: a }))} />}
        </Field>
        <Field label={t("Fuel")}>
          {() => <Segmented aria-label={t("Fuel")} className="w-full" value={p.VehGas} onChange={(v) => set({ VehGas: v })} options={[{ value: "Regular", label: t("Petrol") }, { value: "Diesel", label: t("Diesel") }]} />}
        </Field>
        <Field label={t("Vehicle brand")} hint={t("Brands are anonymised in the dataset")}>
          {(id) => <Select id={id} value={p.VehBrand} onChange={(v) => set({ VehBrand: v })} options={brands.map((b) => ({ value: b, label: b }))} />}
        </Field>
        <Field label={t("Region")} className="sm:col-span-2">
          {(id) => <Select id={id} value={p.Region} onChange={(v) => set({ Region: v })} options={regions.map((r) => ({ value: r, label: r.replace(/-/g, " ") }))} />}
        </Field>
      </div>
      <div className="border-t border-border bg-bg-subtle/60 p-4 lg:border-l lg:border-t-0">
        <p className="text-2xs text-fg-subtle">{t("Expected claims per year")}</p>
        <p className="num mt-1 text-3xl font-semibold tracking-[-0.03em] text-fg">{frequency.toFixed(3)}</p>
        <p className="mt-1 text-xs text-fg-muted">
          {t("{x}× the portfolio average of {avg}. About one claim every {years} years.", { x: (frequency / avg).toFixed(2), avg: avg.toFixed(3), years: (1 / frequency).toFixed(1) })}
        </p>
        <ul className="mt-4 space-y-1.5">
          {terms.map((term) => (
            <li key={term.factor} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-fg-muted">{t(TERM_LABEL[term.factor])} <span className="text-fg-subtle">· {term.level}</span></span>
              <span className={cn("num font-mono", term.multiplier > 1.005 ? "text-warning" : term.multiplier < 0.995 ? "text-positive" : "text-fg-subtle")}>×{term.multiplier.toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-2xs leading-relaxed text-fg-subtle">{t("Multipliers are relative to the base levels, bonus-malus 50, 100 people per km² and area C.")}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function InsurerModel() {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const [calModel, setCalModel] = useState<"glm" | "gbm">("gbm");
  const m = Object.fromEntries(report.models.map((x) => [x.id, x])) as Record<"null" | "glm" | "gbm", Report["models"][number]>;
  const gain = m.gbm.test.devianceExplained / m.glm.test.devianceExplained - 1;
  const bmGlm = report.glm.relativities.BonusMalus as { x: number; relativity: number }[];

  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.from("[data-reveal]", { opacity: 0, y: 10, duration: 0.5, stagger: 0.06, ease: "power2.out" });
      gsap.from("[data-bar]", { scaleX: 0, duration: 0.8, stagger: 0.05, ease: "power3.out", delay: 0.2 });
    },
    { scope: root },
  );

  return (
    <div ref={root}>
      <PageHeader
        meta={<Tag tone="accent"><FlaskConical className="size-3" /> {t("Model study")}</Tag>}
        title={t("Claim frequency model")}
        description={t("How often a motor policy claims, learned from {n} real policies. A Poisson GLM, the way most insurers file their rates, against gradient boosting.", { n: num(report.dataset.policies) })}
      />
      <PageBody className="space-y-4">
        <div data-reveal>
          <Callout tone="accent" icon={<Info />}>
            <span className="text-fg-muted">
              {t("This is a method study on public French motor data (freMTPL2). It doesn't price the Indian estimates elsewhere on this site, whose rules are explained on the Methodology page.")}
            </span>
          </Callout>
        </div>

        <Panel data-reveal className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
          {[
            [t("Policies"), num(report.dataset.policies)],
            [t("Policy-years of exposure"), num(Math.round(report.dataset.exposureYears))],
            [t("Claims"), num(report.dataset.claims)],
            [t("Claims per policy-year"), report.dataset.frequency.toFixed(4)],
          ].map(([k, v], i) => (
            <div key={k} className={cn("px-4 py-3.5", i >= 2 && "max-md:border-t max-md:border-border")}>
              <p className="text-2xs text-fg-subtle">{k}</p>
              <p className="num mt-1 text-xl font-semibold tracking-[-0.02em] text-fg">{v}</p>
            </div>
          ))}
        </Panel>

        <Panel data-reveal>
          <PanelHeader
            title={t("Results on the held-out test set")}
            description={
              <>
                {t("{test} policies the models never saw, split by risk profile so the same driver can't appear in both training and test data.", { test: num(report.split.testPolicies) })}
                <span className="mt-2 block sm:hidden"><Tag tone="positive" dot>{t("GBM explains {pct} more deviance than the GLM", { pct: pct(gain, 0) })}</Tag></span>
              </>
            }
            actions={<span className="max-sm:hidden"><Tag tone="positive" dot>{t("GBM explains {pct} more deviance than the GLM", { pct: pct(gain, 0) })}</Tag></span>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-2xs text-fg-subtle">
                  <th className="px-4 py-2 font-medium">{t("Model")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Poisson deviance")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Deviance explained")}</th>
                  <th className="px-4 py-2 text-right font-medium">Gini</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Predicted ÷ actual")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("5-fold CV deviance")}</th>
                </tr>
              </thead>
              <tbody>
                {report.models.map((row) => (
                  <tr key={row.id} className={cn("border-b border-border/60 last:border-0", row.id === "gbm" && "bg-accent/[0.05]")}>
                    <td className="px-4 py-2.5 text-fg">
                      <span className="mr-2 inline-block size-2 rounded-sm" style={{ background: COLOR[row.id] }} />
                      {row.id === "null" ? t("No model (portfolio average)") : row.name}
                    </td>
                    <td className="num px-4 py-2.5 text-right font-mono text-xs">{row.test.deviance.toFixed(5)}</td>
                    <td className="num px-4 py-2.5 text-right font-mono text-xs">{pct(row.test.devianceExplained, 2)}</td>
                    <td className="num px-4 py-2.5 text-right font-mono text-xs">{row.test.gini.toFixed(3)}</td>
                    <td className="num px-4 py-2.5 text-right font-mono text-xs">{row.test.predictedToActual.toFixed(3)}</td>
                    <td className="num px-4 py-2.5 text-right font-mono text-xs text-fg-muted">
                      {row.cv.deviance.mean.toFixed(5)} <span className="text-fg-subtle">± {row.cv.deviance.sd.toFixed(5)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>
            {t("Lower deviance is better. Most policies never claim, so absolute differences look small; deviance explained and the Gini index compare models more fairly. Predicted ÷ actual close to 1 means the total number of claims is right.")}
          </Note>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel data-reveal>
            <PanelHeader title={t("Ranking risk: Lorenz curve")} description={t("Policies ordered from lowest to highest predicted risk. The further the curve bows below the diagonal, the better the model separates risks.")} />
            <LorenzChart />
          </Panel>
          <Panel data-reveal>
            <PanelHeader
              title={t("Calibration by decile")}
              description={t("Ten equal-exposure groups by predicted frequency. Predictions should track what actually happened.")}
              actions={<Segmented aria-label={t("Model")} value={calModel} onChange={setCalModel} options={[{ value: "glm", label: "GLM" }, { value: "gbm", label: "GBM" }]} />}
            />
            <CalibrationChart model={calModel} />
          </Panel>
        </div>

        <Panel data-reveal>
          <PanelHeader
            title={t("Double lift: where the two models disagree")}
            description={t("Policies sorted by how much higher the GBM prices them than the GLM. At both ends, the observed claims follow the GBM, so its extra structure is real rather than noise.")}
          />
          <DoubleLiftChart />
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Panel data-reveal>
            <PanelHeader title={t("What drives the GBM")} description={t("Mean absolute SHAP value on the log-frequency scale, {n} test policies.", { n: num(report.shap.sampleSize) })} />
            <ImportanceBars />
          </Panel>
          <Panel data-reveal>
            <PanelHeader title={t("How each factor changes frequency")} description={t("Average multiplier from the GBM (SHAP) against the GLM's fitted curve.")} />
            <div className="grid sm:grid-cols-2">
              <EffectChart feature="BonusMalus" label={t("Bonus-malus level")} glm={bmGlm} />
              <EffectChart feature="DrivAge" label={t("Driver age")} />
            </div>
            <Legend items={[["GBM (SHAP)", COLOR.gbm], ["GLM", COLOR.glm, true]]} />
            <Note>
              {t("Bonus-malus dominates because it already records each driver's claim history. It also explains why young drivers look only moderately risky here: new drivers start at a high bonus-malus level, so part of their age effect is carried by that variable instead.")}
            </Note>
          </Panel>
        </div>

        <Panel data-reveal>
          <PanelHeader title={t("The GLM as a rating table")} description={t("Each level's multiplier on claim frequency, relative to the base level. This is the form an insurer files and an underwriter can audit.")} />
          <Relativities />
        </Panel>

        <Panel data-reveal>
          <PanelHeader title={t("Try the GLM")} description={t("The fitted rating table, applied in your browser. Move a factor to see its multiplier.")} />
          <Calculator />
        </Panel>

        <Panel data-reveal>
          <PanelHeader title={t("How it was built")} />
          <ul className="space-y-2 p-4 text-sm leading-6 text-fg-muted">
            <li>{t("Cleaning: exposure capped at one year and claim counts at 4; extreme vehicle age, driver age and bonus-malus values capped.")}</li>
            <li>{t("Offset: every model predicts claims for the policy's own exposure through log(exposure), so a three-month policy is expected to claim a quarter as often.")}</li>
            <li>{t("Leakage: rows with identical rating factors (often the same driver across renewals) are kept on the same side of every split.")}</li>
            <li>{t("Tuning: {n} LightGBM settings compared on a validation split inside the training data, with early stopping; {rounds} trees in the final model. Bonus-malus is constrained to only ever raise the prediction.", { n: report.gbm.tuning.length, rounds: report.gbm.rounds })}</li>
            <li>{t("Validation: 5-fold grouped cross-validation on training data, then one score on the untouched test set.")}</li>
          </ul>
          <Note>
            {t("Limits: French data from the 2000s, frequency only (a full price also needs claim severity, expenses and loadings), and the brand and region codes are as anonymised in the dataset. Source: {citation}", { citation: report.dataset.citation })}{" "}
            <a href="https://github.com/dutangc/CASdatasets" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-border-strong underline-offset-2 hover:text-fg">
              CASdatasets <ExternalLink className="size-3" />
            </a>
            {" · "}
            <Link to="/methodology" className="underline decoration-border-strong underline-offset-2 hover:text-fg">{t("Methodology")}</Link>
          </Note>
        </Panel>
      </PageBody>
    </div>
  );
}
