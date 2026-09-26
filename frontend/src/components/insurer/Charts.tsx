import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, ScatterChart, Scatter, ZAxis,
} from "recharts";
import type { RiskCategory } from "@insurtechai/shared";
import { RISK_ORDER, riskFromScore, inr, inrCompact, num } from "../../lib/utils";
import { useT } from "../../context/I18nContext";

const tick = { fontSize: 11, fill: "hsl(var(--fg-subtle))" };
const grid = "hsl(var(--border))";
const RISK_FILL: Record<RiskCategory, string> = {
  "Very Low": "hsl(var(--risk-1))",
  Low: "hsl(var(--risk-2))",
  Moderate: "hsl(var(--risk-3))",
  High: "hsl(var(--risk-4))",
  "Very High": "hsl(var(--risk-5))",
};

function TipBox({ title, rows }: { title?: string; rows: [string, string][] }) {
  return (
    <div className="rounded-md bg-surface px-2.5 py-2 text-xs shadow-pop">
      {title && <p className="mb-1 font-medium text-fg">{title}</p>}
      {rows.map(([k, v]) => (
        <p key={k} className="flex justify-between gap-4 text-fg-muted">
          <span>{k}</span>
          <span className="num text-fg">{v}</span>
        </p>
      ))}
    </div>
  );
}

/** A single 100% stacked bar with a legend underneath: easier to read than a donut. */
export function RiskMix({ data }: { data: { category: RiskCategory; count: number }[] }) {
  const t = useT();
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const ordered = RISK_ORDER.map((c) => data.find((d) => d.category === c) ?? { category: c, count: 0 });
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-sm">
        {ordered.map((d) => (
          <div key={d.category} style={{ width: `${(d.count / total) * 100}%`, background: RISK_FILL[d.category] }} title={`${t(d.category)}: ${d.count}`} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-5 gap-2">
        {ordered.map((d) => (
          <div key={d.category}>
            <dt className="flex items-center gap-1.5 text-2xs text-fg-subtle">
              <span className="size-2 rounded-sm" style={{ background: RISK_FILL[d.category] }} />
              <span className="truncate">{t(d.category)}</span>
            </dt>
            <dd className="num mt-1 text-md font-medium text-fg">{num(d.count)}</dd>
            <dd className="num text-2xs text-fg-subtle">{Math.round((d.count / total) * 100)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function PremiumBands({ data }: { data: { bucket: string; count: number }[] }) {
  const t = useT();
  const pretty = data.map((d) => ({ ...d, label: d.bucket.replace("k", "K").replace("-", "–").replace(/k/g, "K") }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={pretty} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke={grid} />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: "hsl(var(--fg) / 0.04)" }} content={({ active, payload }) => active && payload?.[0] ? <TipBox title={`₹${payload[0].payload.label}`} rows={[[t("Policies"), num(payload[0].payload.count)]]} /> : null} />
        <Bar dataKey="count" fill="hsl(var(--fg-muted))" radius={[3, 3, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ClaimsTrend({ data }: { data: { month: string; count: number; totalAmount: number }[] }) {
  const t = useT();
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="claimsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.28} />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={grid} />
        <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: "hsl(var(--border-strong))" }}
          content={({ active, payload }) =>
            active && payload?.[0] ? <TipBox title={payload[0].payload.month} rows={[[t("Claims"), num(payload[0].payload.count)], [t("Amount"), inr(payload[0].payload.totalAmount)]]} /> : null
          }
        />
        <Area type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={1.5} fill="url(#claimsFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RiskPremiumScatter({ data }: { data: { riskScore: number; premium: number; insuranceType: string }[] }) {
  const t = useT();
  const byBand = RISK_ORDER.map((c) => ({ c, points: data.filter((d) => riskFromScore(d.riskScore) === c) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
        <CartesianGrid stroke={grid} />
        <XAxis type="number" dataKey="riskScore" domain={[0, 100]} tick={tick} axisLine={false} tickLine={false} name={t("Risk score")} />
        <YAxis type="number" dataKey="premium" scale="log" domain={["auto", "auto"]} tick={tick} axisLine={false} tickLine={false} tickFormatter={inrCompact} width={52} name={t("Premium")} />
        <ZAxis range={[14, 14]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--border-strong))" }}
          content={({ active, payload }) =>
            active && payload?.[0] ? <TipBox title={payload[0].payload.insuranceType} rows={[[t("Risk"), String(payload[0].payload.riskScore)], [t("Premium"), inr(payload[0].payload.premium)]]} /> : null
          }
        />
        {byBand.map(({ c, points }) => (
          <Scatter key={c} data={points} fill={RISK_FILL[c]} fillOpacity={0.75} isAnimationActive={false} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Ranked horizontal bars rendered as a list, for city and segment breakdowns. */
export function RankedBars({ rows, format = num, tone = "neutral" }: { rows: { label: string; value: number; sub?: string }[]; format?: (n: number) => string; tone?: "neutral" | "risk" }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(96px,168px)_1fr_48px] items-center gap-3 text-sm">
          <span className="truncate text-fg-muted" title={r.label}>{r.label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, background: tone === "risk" ? RISK_FILL[riskFromScore(r.value)] : "hsl(var(--fg-muted))" }}
            />
          </span>
          <span className="num text-right text-xs text-fg">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export { Cell };
