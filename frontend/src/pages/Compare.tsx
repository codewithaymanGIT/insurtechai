import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ExternalLink, Info } from "lucide-react";
import { MarketingLayout } from "../components/shell/Marketing";
import { Eyebrow, Tag } from "../components/ui/Primitives";
import { Segmented } from "../components/ui/Controls";
import { ButtonLink } from "../components/ui/Button";
import { useI18n } from "../context/I18nContext";
import { gsap, useGSAP, reducedMotion } from "../lib/motion";
import { HEALTH, HEALTH_INDUSTRY_ICR, LIFE, LIFE_INDUSTRY, SOURCES, type Source } from "../lib/insurers";
import { cn } from "../lib/utils";

type Tab = "health" | "life";
type SortKey = "name" | "csr" | "icr";

function pct(n: number) {
  return `${n.toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** Bar scaled between a floor and 100 so small differences near the top stay visible. */
function Bar({ value, floor, tone = "accent", marker }: { value: number; floor: number; tone?: "accent" | "warning"; marker?: number }) {
  const w = Math.max(2, Math.min(100, ((value - floor) / (100 - floor)) * 100));
  const m = marker != null ? Math.max(0, Math.min(100, ((marker - floor) / (100 - floor)) * 100)) : null;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-surface-3">
      <div data-bar style={{ width: `${w}%` }} className={cn("h-full origin-left rounded-full", tone === "accent" ? "bg-accent" : "bg-warning")} />
      {m != null && <span className="absolute -top-1 h-3.5 w-px bg-fg-subtle" style={{ left: `${m}%` }} />}
    </div>
  );
}

function SortHeader({ label, k, sort, dir, onSort, className }: { label: string; k: SortKey; sort: SortKey; dir: 1 | -1; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort === k;
  return (
    <th className={cn("px-3 py-2 font-medium", className)}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 transition-colors hover:text-fg", active && "text-fg")}>
        {label}
        {active && (dir === -1 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </th>
  );
}

function SourceLink({ s }: { s: Source }) {
  return (
    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-border-strong underline-offset-2 hover:text-fg">
      {s.label} <ExternalLink className="size-3" />
    </a>
  );
}

function Metric({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-medium text-fg">{title}</p>
      <div className="mt-1.5 space-y-2 text-sm leading-6 text-fg-muted">{children}</div>
    </div>
  );
}

function useSort(initial: SortKey) {
  const [sort, setSort] = useState<SortKey>(initial);
  const [dir, setDir] = useState<1 | -1>(-1);
  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(k);
      setDir(k === "name" ? 1 : -1);
    }
  };
  return { sort, dir, onSort };
}

function HealthTable() {
  const { t } = useI18n();
  const { sort, dir, onSort } = useSort("csr");
  const rows = useMemo(
    () => [...HEALTH].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : a[sort] - b[sort]) * dir),
    [sort, dir],
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-2xs text-fg-subtle">
            <SortHeader label={t("Insurer")} k="name" sort={sort} dir={dir} onSort={onSort} />
            <SortHeader label={t("Claims settled")} k="csr" sort={sort} dir={dir} onSort={onSort} className="w-[34%]" />
            <SortHeader label={t("Incurred claim ratio")} k="icr" sort={sort} dir={dir} onSort={onSort} className="w-[26%]" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} data-row className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-fg">
                  {r.name}
                  {r.caution && (
                    <span title={t(r.caution)} className="text-warning">
                      <Info className="size-3.5" aria-label={t(r.caution)} />
                    </span>
                  )}
                </p>
                <p className="text-2xs text-fg-subtle">{t(r.kind)}</p>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="num w-14 shrink-0 font-mono text-xs text-fg">{pct(r.csr)}</span>
                  <Bar value={r.csr} floor={80} />
                </div>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="num font-mono text-xs text-fg">{pct(r.icr)}</span>
                  {r.icr > 100 ? <Tag tone="warning">{t("Above 100%")}</Tag> : r.icr < 65 ? <Tag>{t("Low")}</Tag> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LifeTable() {
  const { t } = useI18n();
  const { sort, dir, onSort } = useSort("csr");
  const rows = useMemo(
    () => [...LIFE].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : a.csr - b.csr) * dir),
    [sort, dir],
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-2xs text-fg-subtle">
            <SortHeader label={t("Insurer")} k="name" sort={sort} dir={dir} onSort={onSort} />
            <SortHeader label={t("Death claims paid, by number")} k="csr" sort={sort} dir={dir} onSort={onSort} className="w-[55%]" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} data-row className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2.5 text-fg">{r.name}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="num w-14 shrink-0 font-mono text-xs text-fg">{pct(r.csr)}</span>
                  <Bar value={r.csr} floor={96} marker={LIFE_INDUSTRY.byNumber} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border bg-surface px-3 py-2 text-2xs text-fg-subtle">
        {t("The line on each bar is the industry figure of {pct}.", { pct: pct(LIFE_INDUSTRY.byNumber) })}
      </p>
    </div>
  );
}

export function Compare() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("health");
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.from("[data-row]", { opacity: 0, y: 4, duration: 0.35, stagger: 0.025, ease: "power2.out" });
      gsap.from("[data-bar]", { scaleX: 0, duration: 0.7, stagger: 0.025, ease: "power3.out", delay: 0.1 });
    },
    { scope: root, dependencies: [tab] },
  );

  return (
    <MarketingLayout>
      <div ref={root} className="mx-auto max-w-4xl px-4 pb-24 pt-14 sm:px-6">
        <Eyebrow>{t("Compare insurers")}</Eyebrow>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance max-sm:text-3xl">{t("How insurers handle claims")}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-fg-muted text-pretty">
          {t("Price is only half the decision. These are the claim records insurers report to IRDAI for 2024-25, with what each number does and doesn't tell you.")}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            aria-label={t("Type of cover")}
            value={tab}
            onChange={setTab}
            options={[
              { value: "health", label: t("Health") },
              { value: "life", label: t("Term life") },
            ]}
          />
          <p className="text-2xs text-fg-subtle">{t("Financial year 2024-25 · click a column to sort")}</p>
        </div>

        <div className="mt-4">{tab === "health" ? <HealthTable /> : <LifeTable />}</div>

        <p className="mt-3 text-2xs leading-relaxed text-fg-subtle">
          {t("Sources")}:{" "}
          {tab === "health" ? (
            <>
              <SourceLink s={SOURCES.healthCsr} /> · <SourceLink s={SOURCES.healthIcr} /> · <SourceLink s={SOURCES.irdai} />
            </>
          ) : (
            <>
              <SourceLink s={SOURCES.life} /> · <SourceLink s={SOURCES.lifeIndustry} /> · <SourceLink s={SOURCES.irdai} />
            </>
          )}
        </p>

        <h2 className="mt-14 text-xl font-semibold tracking-[-0.02em]">{t("Reading the numbers")}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {tab === "health" ? (
            <>
              <Metric title={t("Claims settled")}>
                <p>{t("The share of claims the insurer settled in the year, counted by number. A partly paid claim counts as settled, so a high figure doesn't mean every bill was paid in full.")}</p>
              </Metric>
              <Metric title={t("Incurred claim ratio")}>
                <p>{t("Claims paid out as a share of premiums earned. A low ratio means the insurer kept most of what it collected. Above 100% it paid out more than it earned, which is generous for customers but hard to keep up.")}</p>
                <p className="text-xs text-fg-subtle">
                  {t("Industry {a} · public sector {b} · private general {c} · standalone health {d}", {
                    a: pct(HEALTH_INDUSTRY_ICR.industry),
                    b: pct(HEALTH_INDUSTRY_ICR.publicSector),
                    c: pct(HEALTH_INDUSTRY_ICR.private),
                    d: pct(HEALTH_INDUSTRY_ICR.standalone),
                  })}
                </p>
              </Metric>
            </>
          ) : (
            <>
              <Metric title={t("Death claims paid, by number")}>
                <p>{t("Individual death claims paid as a share of those the insurer decided in the year. Almost every large insurer is above 97%, so small gaps between them rarely matter.")}</p>
              </Metric>
              <Metric title={t("By amount")}>
                <p>
                  {t("By value the industry paid {amount} of claims, lower than {number} by number. Large claims are more likely to be investigated or rejected, often over undisclosed health conditions.", {
                    amount: pct(LIFE_INDUSTRY.byAmount),
                    number: pct(LIFE_INDUSTRY.byNumber),
                  })}
                </p>
              </Metric>
            </>
          )}
          <Metric title={t("What these don't show")}>
            <p>{t("How long claims took, how much of each bill was deducted, and how many complaints the insurer received. Check the insurer's public disclosures and the IRDAI grievance data for those.")}</p>
          </Metric>
          <Metric title={t("What matters most")}>
            <p>
              {tab === "health"
                ? t("Disclose every condition on the proposal form, and read the waiting periods, room-rent limits and co-payment terms. Most rejected claims trace back to one of these.")
                : t("Disclose every condition, smoking and your real income on the proposal form. Non-disclosure is the most common reason life claims are rejected.")}
            </p>
          </Metric>
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-fg">{t("Know what a fair price looks like first")}</p>
            <p className="mt-0.5 text-sm text-fg-muted">{t("Get an estimate for your profile, then compare quotes from these insurers against it.")}</p>
          </div>
          <ButtonLink to="/estimate/new" variant="primary" size="md">{t("Get an estimate")}</ButtonLink>
        </div>

        <p className="mt-8 text-2xs leading-relaxed text-fg-subtle">
          {t("InsurTechAI has no commercial relationship with any insurer listed. The order here is by the column you choose, not a recommendation.")}{" "}
          <Link to="/methodology" className="underline decoration-border-strong underline-offset-2 hover:text-fg">{t("Methodology")}</Link>
        </p>
      </div>
    </MarketingLayout>
  );
}
