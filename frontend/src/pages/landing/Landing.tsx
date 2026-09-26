import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calculator, Gauge, SlidersHorizontal, MessageSquare, FilePlus2, LayoutGrid, FlaskConical } from "lucide-react";
import { MarketingLayout } from "../../components/shell/Marketing";
import { ButtonLink } from "../../components/ui/Button";
import { Eyebrow, Tag, Kbd } from "../../components/ui/Primitives";
import { RiskMeter } from "../../components/estimate/RiskMeter";
import { BenchmarkBar } from "../../components/estimate/BenchmarkBar";
import { PremiumLedger } from "../../components/estimate/PremiumLedger";
import { FactorChart } from "../../components/estimate/FactorChart";
import { gsap, useGSAP, ScrollTrigger, SplitText, reducedMotion } from "../../lib/motion";
import { COVER_LABEL, cn, inr } from "../../lib/utils";
import { useI18n } from "../../context/I18nContext";
import { SAMPLES } from "./sample";

// Only the first entry is a description; the rest are brand names and stay in English.
const SOURCES = [
  { name: "IRDAI third-party tariffs", translate: true },
  { name: "Forbes Advisor India" },
  { name: "HDFC ERGO" },
  { name: "Niva Bupa" },
  { name: "Nyvo" },
  { name: "SMC Insurance" },
  { name: "Insure24" },
];

/**
 * Headline that reveals line by line from behind a mask. Splitting by lines is
 * safe for Indic scripts (lines break between words). Split elements are keyed
 * by their text, so React remounts them when the translation changes, and the
 * effect re-runs (reverting the old splits) when t changes.
 */
function useSplitReveal(scope: React.RefObject<HTMLElement | null>, selector: string, opts: { scroll?: boolean; delay?: number } = {}) {
  const { t } = useI18n();
  useGSAP(
    () => {
      if (reducedMotion()) return;
      const els = gsap.utils.toArray<HTMLElement>(selector, scope.current);
      els.forEach((el) => {
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 105,
              duration: 0.9,
              stagger: 0.08,
              ease: "expo.out",
              delay: opts.delay ?? 0,
              scrollTrigger: opts.scroll ? { trigger: el, start: "top 85%", once: true } : undefined,
            }),
        });
      });
    },
    { scope, dependencies: [t], revertOnUpdate: true },
  );
}

/** The engine-generated example, in the visitor's language. */
function useSample() {
  const { lang } = useI18n();
  return SAMPLES[lang] ?? SAMPLES.en;
}

function Frame({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border-strong bg-bg-subtle shadow-[0_40px_120px_-40px_rgb(0_0_0/0.6)]", className)}>
      <div className="flex h-9 items-center gap-2 border-b border-border px-3.5 text-2xs text-fg-subtle">
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}

function HeroProduct() {
  const SAMPLE = useSample();
  const { t } = useI18n();
  const nav = [
    { icon: FilePlus2, label: "New estimate" },
    { icon: Gauge, label: "Your estimate", active: true },
    { icon: SlidersHorizontal, label: "What-if" },
    { icon: MessageSquare, label: "Ask" },
  ];
  return (
    <Frame title={`insurtechai / ${t("your estimate")}`}>
      <div className="grid md:grid-cols-[180px_1fr]">
        <aside className="hidden border-r border-border p-2 md:block">
          {nav.map((n) => (
            <div key={n.label} className={cn("flex h-7 items-center gap-2 rounded px-2 text-xs", n.active ? "bg-surface-2 text-fg" : "text-fg-subtle")}>
              <n.icon className="size-3.5" /> {t(n.label)}
            </div>
          ))}
        </aside>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap gap-1.5">
            <Tag>{t("Motor")}</Tag>
            <Tag>{t("{level} cover", { level: t(COVER_LABEL.STANDARD) })}</Tag>
            <Tag>Bengaluru</Tag>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <Eyebrow>{t("Estimated premium")}</Eyebrow>
              <p className="num mt-2 text-4xl font-semibold tracking-[-0.045em]">
                {inr(SAMPLE.premium.finalPremium)} <span className="text-sm font-normal tracking-normal text-fg-subtle">{t("/ year")}</span>
              </p>
              <p className="mt-3 max-w-md text-sm text-fg-muted">{SAMPLE.verdict}</p>
              <div className="mt-5">
                <BenchmarkBar benchmark={SAMPLE.benchmark} premium={SAMPLE.premium.finalPremium} />
              </div>
            </div>
            <div className="hidden flex-col items-center justify-center rounded-lg border border-border bg-surface p-4 lg:flex">
              <RiskMeter score={SAMPLE.risk.riskScore} category={SAMPLE.risk.riskCategory} size={170} />
            </div>
          </div>
          <div className="mt-4 hidden overflow-hidden rounded-lg border border-border bg-surface sm:block">
            <FactorChart factors={SAMPLE.risk.factors.slice(0, 3)} />
          </div>
        </div>
      </div>
    </Frame>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Your answers become named factors",
    body: "Each answer adds or removes points. You see every factor, how many points it's worth and why, so there's no mystery score.",
  },
  {
    n: "02",
    title: "The factors set the price",
    body: "A base price for your cover is multiplied step by step: risk, city, claim history, deductible. For motor, the base is a share of the vehicle's IDV, the no-claim bonus comes off the own-damage part, and the fixed IRDAI third-party amount goes on top.",
  },
  {
    n: "03",
    title: "The price is checked against the market",
    body: "Your estimate is placed on the range that insurers and comparison sites publish for similar cover, with links to each source.",
  },
];

function HowItWorks() {
  const SAMPLE = useSample();
  const { t } = useI18n();
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const visuals = gsap.utils.toArray<HTMLElement>("[data-visual]");
        const steps = gsap.utils.toArray<HTMLElement>("[data-step]");
        gsap.set(visuals.slice(1), { autoAlpha: 0, y: 24 });
        gsap.set(steps.slice(1), { opacity: 0.35 });

        const tl = gsap.timeline({
          scrollTrigger: { trigger: "[data-pin]", start: "top top+=56", end: "+=1600", pin: true, scrub: 0.6, anticipatePin: 1 },
        });
        tl.to("[data-progress]", { scaleY: 1, ease: "none", duration: 2 }, 0);
        for (let i = 1; i < visuals.length; i++) {
          const at = i - 0.5;
          tl.to(visuals[i - 1], { autoAlpha: 0, y: -24, duration: 0.3 }, at)
            .to(visuals[i], { autoAlpha: 1, y: 0, duration: 0.3 }, at + 0.15)
            .to(steps[i - 1], { opacity: 0.35, duration: 0.2 }, at)
            .to(steps[i], { opacity: 1, duration: 0.2 }, at);
        }
      });
      mm.add("(max-width: 1023px)", () => {
        gsap.utils.toArray<HTMLElement>("[data-mobile-card]").forEach((el) =>
          gsap.from(el, { opacity: 0, y: 24, duration: 0.6, scrollTrigger: { trigger: el, start: "top 85%", once: true } }),
        );
      });
    },
    { scope: root },
  );

  const visuals = [
    <div key="f" className="overflow-hidden rounded-lg border border-border bg-surface"><FactorChart factors={SAMPLE.risk.factors} /></div>,
    <div key="l" className="overflow-hidden rounded-lg border border-border bg-surface"><PremiumLedger premium={SAMPLE.premium} applicant={SAMPLE.applicant} /></div>,
    <div key="b" className="rounded-lg border border-border bg-surface p-5">
      <p className="num text-3xl font-semibold tracking-[-0.04em]">{inr(SAMPLE.premium.finalPremium)}</p>
      <p className="mt-2 text-sm text-fg-muted">{SAMPLE.verdict}</p>
      <div className="mt-5"><BenchmarkBar benchmark={SAMPLE.benchmark} premium={SAMPLE.premium.finalPremium} /></div>
      <p className="mt-3 text-2xs text-fg-subtle">{t("Range: {source}, average cost of car insurance (2026)", { source: "Forbes Advisor India" })}</p>
    </div>,
  ];

  return (
    <section ref={root} id="how" className="scroll-mt-14 border-t border-border">
      <div className="mx-auto max-w-page px-4 pt-24 sm:px-6">
        <Eyebrow>{t("How it works")}</Eyebrow>
        <h2 key={t("Your premium, line by line.")} data-split className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.035em] text-balance max-sm:text-3xl">{t("Your premium, line by line.")}</h2>
      </div>

      {/* Desktop: pinned, visuals swap as you scroll */}
      <div data-pin className="mx-auto hidden min-h-[calc(100vh-56px)] max-w-page grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] content-center items-center gap-16 px-6 py-14 lg:grid">
        <div className="relative pl-6">
          <div className="absolute inset-y-0 left-0 w-px bg-border" />
          <div data-progress className="absolute inset-x-0 left-0 top-0 h-full w-px origin-top scale-y-0 bg-accent" />
          <ol className="space-y-12">
            {STEPS.map((s) => (
              <li key={s.n} data-step>
                <p className="font-mono text-xs text-accent-text">{s.n}</p>
                <h3 className="mt-2 text-xl font-medium tracking-[-0.015em]">{t(s.title)}</h3>
                <p className="mt-2 max-w-md text-md leading-7 text-fg-muted">{t(s.body)}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative min-h-[460px]">
          {visuals.map((v, i) => (
            <div key={i} data-visual className="absolute inset-x-0 top-0">
              {v}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile and tablet: stacked */}
      <div className="mx-auto max-w-page space-y-14 px-4 pb-20 pt-10 sm:px-6 lg:hidden">
        {STEPS.map((s, i) => (
          <div key={s.n} data-mobile-card>
            <p className="font-mono text-xs text-accent-text">{s.n}</p>
            <h3 className="mt-2 text-xl font-medium">{t(s.title)}</h3>
            <p className="mt-2 text-md leading-7 text-fg-muted">{t(s.body)}</p>
            <div className="mt-5">{visuals[i]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Track({ id, value }: { id: string; value: string }) {
  return (
    <div className="relative mt-3 h-1 rounded-full bg-surface-3">
      <div className="absolute inset-y-0 left-0 rounded-full bg-accent" {...{ [`data-fill-${id}`]: "" }} style={{ width: value }} />
      <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-bg" {...{ [`data-thumb-${id}`]: "" }} style={{ left: value }} />
    </div>
  );
}

function WhatIfDemo() {
  const SAMPLE = useSample();
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [s1, s2, s3] = SAMPLE.scenario.steps;
  const start = SAMPLE.premium.finalPremium;

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const price = q("[data-price]")[0] as HTMLElement;
      const delta = q("[data-delta]")[0] as HTMLElement;
      const state = { v: start };
      const render = () => {
        price.textContent = inr(state.v);
        const d = Math.round(state.v - start);
        delta.textContent = d === 0 ? t("No change yet") : t("−{amount} a year", { amount: inr(Math.abs(d)) });
      };
      render();
      if (reducedMotion()) {
        state.v = s3;
        render();
        gsap.set(q("[data-thumb-ded]"), { left: "25%" });
        gsap.set(q("[data-fill-ded]"), { width: "25%" });
        gsap.set(q("[data-thumb-km]"), { left: "26%" });
        gsap.set(q("[data-fill-km]"), { width: "26%" });
        gsap.set(q("[data-switch-on]"), { opacity: 1 });
        gsap.set(q("[data-knob]"), { x: 14 });
        return;
      }

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true, defaults: { ease: "power2.inOut" } });
      tl.set(state, { v: start, onComplete: render })
        .set(q("[data-thumb-ded]"), { left: "0%" })
        .set(q("[data-fill-ded]"), { width: "0%" })
        .set(q("[data-thumb-km]"), { left: "41%" })
        .set(q("[data-fill-km]"), { width: "41%" })
        .set(q("[data-switch-on]"), { opacity: 0 })
        .set(q("[data-knob]"), { x: 0 })
        .set(q("[data-row]"), { opacity: 0.45 })
        .to(q("[data-row='ded']"), { opacity: 1, duration: 0.2 }, 0.6)
        .to(q("[data-thumb-ded]"), { left: "25%", duration: 0.9 }, 0.7)
        .to(q("[data-fill-ded]"), { width: "25%", duration: 0.9 }, 0.7)
        .to(state, { v: s1, duration: 0.9, onUpdate: render }, 0.7)
        .to(q("[data-row='ded']"), { opacity: 0.45, duration: 0.2 }, 1.9)
        .to(q("[data-row='tracker']"), { opacity: 1, duration: 0.2 }, 1.9)
        .to(q("[data-switch-on]"), { opacity: 1, duration: 0.2 }, 2.2)
        .to(q("[data-knob]"), { x: 14, duration: 0.2 }, 2.2)
        .to(state, { v: s2, duration: 0.7, onUpdate: render }, 2.25)
        .to(q("[data-row='tracker']"), { opacity: 0.45, duration: 0.2 }, 3.2)
        .to(q("[data-row='km']"), { opacity: 1, duration: 0.2 }, 3.2)
        .to(q("[data-thumb-km]"), { left: "26%", duration: 0.9 }, 3.3)
        .to(q("[data-fill-km]"), { width: "26%", duration: 0.9 }, 3.3)
        .to(state, { v: s3, duration: 0.9, onUpdate: render }, 3.3)
        .to(q("[data-row]"), { opacity: 1, duration: 0.3 }, 4.4)
        .to({}, { duration: 2.2 });

      ScrollTrigger.create({ trigger: root.current, start: "top 75%", end: "bottom 20%", onToggle: (self) => (self.isActive ? tl.play() : tl.pause()) });
    },
    // Re-run when the language changes so the delta text is re-rendered in it.
    { scope: root, dependencies: [t], revertOnUpdate: true },
  );


  return (
    <div ref={root}>
      <Frame title={`insurtechai / ${t("what-if")}`}>
        <div className="grid sm:grid-cols-[1fr_220px]">
          <div className="divide-y divide-border/60">
            <div data-row="ded" className="px-5 py-4">
              <div className="flex justify-between text-sm"><span>{t("Voluntary deductible")}</span><span className="font-mono text-xs text-fg-muted">₹0 → ₹25,000</span></div>
              <Track id="ded" value="0%" />
            </div>
            <div data-row="tracker" className="flex items-center justify-between px-5 py-4 text-sm">
              <span>{t("Anti-theft device fitted")}</span>
              <span className="relative flex h-[18px] w-8 items-center overflow-hidden rounded-full border border-border-strong bg-surface-3 p-[2px]">
                <span data-switch-on className="absolute inset-0 bg-accent opacity-0" />
                <span data-knob className="relative block size-3 rounded-full bg-fg" />
              </span>
            </div>
            <div data-row="km" className="px-5 py-4">
              <div className="flex justify-between text-sm"><span>{t("Distance a year")}</span><span className="font-mono text-xs text-fg-muted">18,000 → 12,000 km</span></div>
              <Track id="km" value="41%" />
            </div>
          </div>
          <div className="flex flex-col justify-center border-t border-border bg-surface p-5 sm:border-l sm:border-t-0">
            <Eyebrow>{t("With changes")}</Eyebrow>
            <p data-price className="num mt-2 text-3xl font-semibold tracking-[-0.04em]">{inr(start)}</p>
            <p data-delta className="num mt-1 text-sm text-positive">{t("No change yet")}</p>
          </div>
        </div>
      </Frame>
    </div>
  );
}

function AskDemo() {
  const SAMPLE = useSample();
  const { t, lang } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const question = t("How can I reduce my premium?");
  useGSAP(
    () => {
      if (reducedMotion()) return;
      const q = gsap.utils.selector(root);
      // Splitting Indic text into characters breaks conjuncts and vowel signs,
      // so other languages type in word by word.
      const byChar = lang === "en";
      const qSplit = SplitText.create(q("[data-question]"), { type: byChar ? "chars" : "words" });
      const aSplit = SplitText.create(q("[data-answer]"), { type: "words" });
      gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 70%", once: true } })
        .from(q("[data-bubble]"), { opacity: 0, y: 8, duration: 0.3 })
        .from(byChar ? qSplit.chars : qSplit.words, { opacity: 0, duration: 0.01, stagger: byChar ? 0.035 : 0.12 }, "<0.1")
        .from(q("[data-dots]"), { opacity: 0, duration: 0.2 })
        .to(q("[data-dots]"), { opacity: 0, duration: 0.2 }, "+=0.7")
        .from(q("[data-source]"), { opacity: 0, y: 4, duration: 0.3 })
        .from(aSplit.words, { opacity: 0, duration: 0.2, stagger: 0.025 }, "<");
    },
    // SplitText instances created here are recorded by the context and reverted before each re-run.
    { scope: root, dependencies: [lang, question], revertOnUpdate: true },
  );

  return (
    <div ref={root}>
      <Frame title={`insurtechai / ${t("ask")}`}>
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex justify-end">
            <p data-bubble className="rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm">
              <span key={question} data-question>{question}</span>
            </p>
          </div>
          <div data-dots className="flex gap-1">
            {[0, 1, 2].map((i) => <span key={i} className="size-1.5 rounded-full bg-fg-subtle" />)}
          </div>
          <div>
            <div data-source className="mb-2"><Tag><Calculator className="size-3" /> {t("From your numbers")}</Tag></div>
            <p data-answer className="text-md leading-relaxed text-fg-muted">{SAMPLE.answer}</p>
          </div>
        </div>
      </Frame>
    </div>
  );
}

/** Figures from the seeded sample portfolio (deterministic seed), not invented. */
const PORTFOLIO = {
  policies: 693,
  avgPremium: 24963,
  highRisk: 28,
  mix: [453, 130, 82, 27, 1],
  cities: [["Mumbai", 28.2], ["Surat", 24.3], ["Kochi", 21.6], ["Lucknow", 20.9]] as [string, number][],
};

function InsurerPreview() {
  const { t } = useI18n();
  const total = PORTFOLIO.mix.reduce((a, b) => a + b, 0);
  const tones = ["bg-risk-1", "bg-risk-2", "bg-risk-3", "bg-risk-4", "bg-risk-5"];
  const maxCity = Math.max(...PORTFOLIO.cities.map((c) => c[1]));
  return (
    <Frame title={`insurtechai / ${t("insurer workspace")}`}>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
          {[
            [t("Policies"), String(PORTFOLIO.policies)],
            [t("Average premium"), inr(PORTFOLIO.avgPremium)],
            [t("High risk"), String(PORTFOLIO.highRisk)],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface px-3 py-3">
              <p className="text-2xs text-fg-subtle">{k}</p>
              <p className="num mt-1 text-md font-medium">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-fg-muted">{t("Risk mix")}</p>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-sm">
            {PORTFOLIO.mix.map((n, i) => (
              <div key={i} className={tones[i]} style={{ width: `${(n / total) * 100}%` }} />
            ))}
          </div>
          <p className="mt-5 text-xs text-fg-muted">{t("Highest average risk by city")}</p>
          <div className="mt-3 space-y-2">
            {PORTFOLIO.cities.map(([city, v]) => (
              <div key={city} className="grid grid-cols-[80px_1fr_36px] items-center gap-3 text-xs">
                <span className="text-fg-muted">{city}</span>
                <span className="h-1.5 rounded-full bg-surface-3"><span className="block h-full rounded-full bg-fg-muted" style={{ width: `${(v / maxCity) * 100}%` }} /></span>
                <span className="num text-right text-fg">{v.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function Landing() {
  const SAMPLE = useSample();
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [kbdBefore, kbdAfter = ""] = t("Inside the app, press {key} to start a new one any time").split("{key}");

  // Translated text changes heights, so pinned and scroll-triggered positions need recalculating.
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [t]);

  useSplitReveal(root, "[data-hero-title]", { delay: 0.1 });
  useSplitReveal(root, "[data-split]", { scroll: true });

  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.from("[data-hero-fade]", { opacity: 0, y: 14, duration: 0.8, stagger: 0.08, delay: 0.35, ease: "power3.out" });
      gsap.from("[data-hero-product]", { opacity: 0, y: 60, duration: 1.2, delay: 0.5, ease: "expo.out" });
      gsap.fromTo(
        "[data-hero-tilt]",
        { rotateX: 16, scale: 0.94, transformPerspective: 1400, transformOrigin: "50% 0%" },
        { rotateX: 0, scale: 1, ease: "none", scrollTrigger: { trigger: "[data-hero-product]", start: "top 90%", end: "top 25%", scrub: 0.5 } },
      );
      gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((el) =>
        gsap.from(el, { opacity: 0, y: 32, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } }),
      );
      gsap.from("[data-source-name]", { opacity: 0, y: 6, duration: 0.5, stagger: 0.05, scrollTrigger: { trigger: "[data-sources]", start: "top 90%", once: true } });
    },
    { scope: root },
  );

  return (
    <MarketingLayout>
      <div ref={root} className="overflow-x-clip">
        {/* Hero */}
        <section className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-dots mask-fade-b" />
          <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-[120px]" />
          <div className="relative mx-auto max-w-page px-4 pt-20 sm:px-6 sm:pt-28">
            <h1 key={t("Know what your insurance should cost.")} data-hero-title className="max-w-4xl text-6xl font-semibold leading-[0.98] tracking-[-0.045em] max-md:text-5xl max-sm:text-[40px] max-sm:leading-[1.02]">
              {t("Know what your insurance should cost.")}
            </h1>
            <p data-hero-fade className="mt-6 max-w-xl text-lg leading-8 text-fg-muted">
              {t("Get an estimate for health, motor, home or term-life cover in India.")}{" "}
              {t("See what's pushing the price up, how it compares with published market rates, and what would bring it down.")}
            </p>
            <div data-hero-fade className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink to="/estimate/new" variant="primary" size="xl">
                {t("Get an estimate")} <ArrowRight />
              </ButtonLink>
              <ButtonLink to="/methodology" variant="ghost" size="xl" className="text-fg">
                {t("How it's calculated")}
              </ButtonLink>
            </div>
            <p data-hero-fade className="mt-4 text-xs text-fg-subtle">{t("Free. About two minutes. No account needed.")}</p>

            <div data-hero-product className="mt-16 [perspective:1400px] sm:mt-20">
              <div data-hero-tilt className="will-change-transform">
                <HeroProduct />
              </div>
            </div>
          </div>
        </section>

        {/* Sources */}
        <section data-sources className="mx-auto max-w-page px-4 pb-20 pt-16 sm:px-6">
          <p className="text-center text-xs text-fg-subtle">{t("Estimates are checked against figures published by")}</p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {SOURCES.map((s) => (
              <li key={s.name} data-source-name className="text-sm font-medium text-fg-muted">{s.translate ? t(s.name) : s.name}</li>
            ))}
          </ul>
        </section>

        <HowItWorks />

        {/* What-if */}
        <section className="border-t border-border">
          <div className="mx-auto grid max-w-page items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <Eyebrow>{t("What-if")}</Eyebrow>
              <h2 key={t("Try a change before you make it.")} data-split className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance max-sm:text-3xl">{t("Try a change before you make it.")}</h2>
              <p data-rise className="mt-5 max-w-md text-md leading-7 text-fg-muted">
                {t("Raise the deductible, fit an anti-theft device, drive less, quit smoking.")}{" "}
                {t("Each change goes back through the full model, so you see what it's worth for you, and whether it's worth the effort.")}
              </p>
              <p data-rise className="mt-4 text-sm text-fg-subtle">
                {t("In this example the three changes save {amount} a year.", { amount: inr(SAMPLE.premium.finalPremium - SAMPLE.scenario.premium) })}{" "}
                {t("Useful to know before you pay for a tracker.")}
              </p>
            </div>
            <div data-rise>
              <WhatIfDemo />
            </div>
          </div>
        </section>

        {/* Ask */}
        <section className="border-t border-border">
          <div className="mx-auto grid max-w-page items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div data-rise className="order-2 lg:order-1">
              <AskDemo />
            </div>
            <div className="order-1 lg:order-2">
              <Eyebrow>{t("Ask")}</Eyebrow>
              <h2 key={t("Ask about your own numbers.")} data-split className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance max-sm:text-3xl">{t("Ask about your own numbers.")}</h2>
              <p data-rise className="mt-5 max-w-md text-md leading-7 text-fg-muted">
                {t("Six common questions are answered straight from your estimate.")}{" "}
                {t("Sign in and you can ask your own, answered by Google's Gemini with your estimate as context and told to stick to it.")}
              </p>
              <ul data-rise className="mt-6 space-y-2 text-sm text-fg-muted">
                <li className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-accent" /> {t("Is it worth raising my deductible?")}</li>
                <li className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-accent" /> {t("Why is my premium above the usual range?")}</li>
                <li className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-accent" /> {t("What would an insurer ask me to prove?")}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Insurers */}
        <section className="border-t border-border">
          <div className="mx-auto grid max-w-page items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow>{t("For insurers")}</Eyebrow>
              <h2 key={t("The same engine, across a whole book.")} data-split className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance max-sm:text-3xl">{t("The same engine, across a whole book.")}</h2>
              <p data-rise className="mt-5 max-w-md text-md leading-7 text-fg-muted">
                {t("The insurer workspace runs the pricing model over a sample portfolio of 500 policyholders: risk mix, loss ratio, premium bands, high-risk cities and applications flagged for review, with a drill-down into every policy.")}
              </p>
              <p data-rise className="mt-3 text-sm text-fg-subtle">{t("The portfolio is synthetic.")} {t("No real customer data is used.")}</p>
              <p data-rise className="mt-3 max-w-md text-sm text-fg-muted">
                {t("It also has a claim frequency study on 677,991 real French motor policies: a Poisson GLM against gradient boosting, with calibration, lift and SHAP.")}
              </p>
              <div data-rise className="mt-7 flex flex-wrap gap-2">
                <ButtonLink to="/insurers" size="lg"><LayoutGrid /> {t("Open the workspace")}</ButtonLink>
                <ButtonLink to="/insurers/model" size="lg" variant="ghost"><FlaskConical /> {t("See the model")}</ButtonLink>
              </div>
            </div>
            <div data-rise>
              <InsurerPreview />
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="relative border-t border-border">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-dots opacity-60 [mask-image:linear-gradient(to_top,black,transparent)]" />
          <div className="relative mx-auto max-w-page px-4 py-28 text-center sm:px-6">
            <h2 key={t("Check the price before you buy.")} data-split className="mx-auto max-w-2xl text-5xl font-semibold tracking-[-0.04em] text-balance max-sm:text-4xl">{t("Check the price before you buy.")}</h2>
            <p data-rise className="mx-auto mt-5 max-w-md text-md text-fg-muted">
              {t("Then go to an insurer or aggregator knowing roughly what you should pay and which questions to ask.")}
            </p>
            <p data-rise className="mx-auto mt-3 max-w-md text-sm text-fg-subtle">
              {t("Health and term-life estimates also show the income-tax saving under the old regime.")}{" "}
              <Link to="/compare" className="text-accent-text hover:underline">{t("Compare insurers' claim settlement records")}</Link>
            </p>
            <div data-rise className="mt-9 flex flex-col items-center gap-3">
              <ButtonLink to="/estimate/new" variant="primary" size="xl">{t("Get an estimate")} <ArrowRight /></ButtonLink>
              <p className="flex items-center gap-1.5 text-xs text-fg-subtle">{kbdBefore.trim()} <Kbd>N</Kbd> {kbdAfter.trim()}</p>
            </div>
          </div>
        </section>

      </div>
    </MarketingLayout>
  );
}
