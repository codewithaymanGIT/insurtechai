import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { LANGUAGES, type Lang } from "@insurtechai/shared";
import { MarketingLayout } from "../components/shell/Marketing";
import { Eyebrow } from "../components/ui/Primitives";
import { useI18n } from "../context/I18nContext";
import { cn } from "../lib/utils";

const SECTIONS = [
  { id: "what", label: "What this is" },
  { id: "score", label: "The risk score" },
  { id: "premium", label: "The premium" },
  { id: "motor", label: "Motor: IDV and no-claim bonus" },
  { id: "tax", label: "Tax savings" },
  { id: "sources", label: "Market ranges and sources" },
  { id: "insurers", label: "Insurer claim records" },
  { id: "fairness", label: "What isn't used" },
  { id: "ai", label: "The AI assistant" },
  { id: "privacy", label: "Privacy" },
  { id: "languages", label: "Languages" },
  { id: "limits", label: "Limitations" },
];

const WEIGHTS: [string, number[]][] = [
  // age, lifestyle, claims, city, asset, behaviour, consistency
  ["Health", [20, 45, 10, 10, 0, 0, 15]],
  ["Motor", [10, 0, 30, 15, 15, 25, 5]],
  ["Home", [0, 0, 20, 30, 25, 20, 5]],
  ["Term life", [30, 30, 0, 10, 0, 20, 10]],
];
const WEIGHT_COLS = ["Age", "Lifestyle", "Claims", "City", "Asset", "Behaviour", "Consistency"];

type SourceItem = { name: string; what: string; url: string };

// `name` is a publisher and stays in English; `what` is translated at render.
const SOURCES: SourceItem[] = [
  { name: "Forbes Advisor India", what: "Average car insurance premiums by segment (2026)", url: "https://www.forbes.com/advisor/in/car-insurance/average-cost-of-car-insurance/" },
  { name: "Insure24", what: "Comprehensive two-wheeler premiums (2026)", url: "https://www.insure24.com/blog/comprehensive-bike-insurance-india/" },
  { name: "Insure24", what: "IRDAI third-party car premiums by engine size", url: "https://www.insure24.com/blog/third-party-car-insurance-premium-rates-irdai/" },
  { name: "ACKO", what: "IRDAI third-party two-wheeler premiums by engine size", url: "https://www.acko.com/third-party-bike-insurance/" },
  { name: "Niva Bupa", what: "Average health insurance premiums in India (2025)", url: "https://www.nivabupa.com/health-insurance-articles/what-is-the-average-health-insurance-premium-in-india.html" },
  { name: "HDFC ERGO", what: "Average health insurance cost in India", url: "https://www.hdfcergo.com/blogs/health-insurance/average-health-insurance-cost-in-india" },
  { name: "Nyvo", what: "₹1 crore term insurance premiums by age (2026)", url: "https://nyvo.in/term-insurance/1-crore-cost-breakdown" },
  { name: "SMC Insurance", what: "Home insurance cost by property value (2026)", url: "https://www.smcinsurance.com/home-insurance/articles/how-much-does-home-insurance-cost" },
];

const MOTOR_SOURCES: SourceItem[] = [
  { name: "IFFCO Tokio", what: "IDV depreciation table", url: "https://www.iffcotokio.co.in/content/dam/iffcotokio/iffco-pdf/sites/default/files/IDV-Depreciation-Table.pdf" },
  { name: "Zurich Kotak", what: "Vehicle depreciation rates", url: "https://www.zurichkotak.com/knowledge-center/car-insurance/vehicle-depreciation-rates" },
  { name: "Tata AIG", what: "No-claim bonus in car insurance", url: "https://www.tataaig.com/motor-insurance/car-insurance/no-claim-bonus-in-car-insurance" },
];

const TAX_SOURCES: SourceItem[] = [
  { name: "Income Tax Department", what: "Section 126: deduction for health insurance premium", url: "https://www.incometaxindia.gov.in/w/section-126-92" },
  { name: "Income Tax Department", what: "Section 123: deduction for life insurance premium and other savings", url: "https://www.incometaxindia.gov.in/w/section-123-2" },
  { name: "Income Tax Department", what: "Schedule XV: payments that qualify under Section 123", url: "https://www.incometaxindia.gov.in/w/schedule-xv-2" },
  { name: "Income Tax Department", what: "Income-tax rates, including the old-regime slabs", url: "https://www.incometaxindia.gov.in/w/tax-rates%E2%80%8B" },
  { name: "Business Today", what: "Section 80C becomes Section 123 from 1 April 2026", url: "https://www.businesstoday.in/personal-finance/tax/story/income-tax-act-2025-section-80c-becomes-section-123-from-april-1-2026-heres-what-taxpayers-must-know-522120-2026-03-24" },
];

function native(code: Lang) {
  return LANGUAGES.find((l) => l.code === code)!.native;
}

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 border-t border-border pt-10 text-xl font-semibold tracking-[-0.02em] text-fg first:border-0 first:pt-0">
      {children}
    </h2>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-md leading-7 text-fg-muted text-pretty">{children}</p>;
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-2xs text-fg-subtle">
            {head.map((h, i) => <th key={h} className={cn("px-3 py-2 font-medium", i > 0 && "text-right")}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {r.map((c, j) => <td key={j} className={cn("px-3 py-2", j === 0 ? "text-fg" : "num text-right font-mono text-xs text-fg-muted")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceList({ items }: { items: SourceItem[] }) {
  const { t } = useI18n();
  return (
    <ul className="mt-5 divide-y divide-border rounded-lg border border-border">
      {items.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface">
            <span>
              <span className="block text-sm text-fg">{s.name}</span>
              <span className="block text-xs text-fg-subtle">{t(s.what)}</span>
            </span>
            <ExternalLink className="size-3.5 shrink-0 text-fg-subtle" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Section({ id }: { id: string }) {
  const { t } = useI18n();
  return <H2 id={id}>{t(SECTIONS.find((s) => s.id === id)!.label)}</H2>;
}

export function Methodology() {
  const { t } = useI18n();
  const [active, setActive] = useState("what");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-page px-4 pb-24 pt-14 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>{t("Methodology")}</Eyebrow>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] max-sm:text-3xl">{t("How the estimate is calculated")}</h1>
          <p className="mt-4 text-lg leading-8 text-fg-muted">
            {t("Every number on your estimate comes from the formulas and sources on this page.")}{" "}
            {t("If something looks wrong, this is where to check it.")}
          </p>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[200px_minmax(0,680px)]">
          <nav className="hidden lg:block" aria-label={t("On this page")}>
            <ul className="sticky top-24 space-y-1 border-l border-border">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      "-ml-px block border-l py-1 pl-4 text-sm transition-colors",
                      active === s.id ? "border-accent text-fg" : "border-transparent text-fg-subtle hover:text-fg-muted",
                    )}
                  >
                    {t(s.label)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <article className="space-y-2">
            <Section id="what" />
            <P>
              {t("InsurTechAI estimates what a health, motor, home or term-life policy like yours typically costs in India, and shows the working.")}{" "}
              {t("It isn't an insurer, broker or IRDAI-registered intermediary.")}{" "}
              {t("It doesn't sell policies and has no commercial arrangement with any insurer, so nothing here is ranked or nudged towards a product.")}
            </P>
            <P>
              {t("An estimate is not a quote.")}{" "}
              {t("Insurers price with their own claims data, medical tests and underwriting rules, and their final price can differ from this one in either direction.")}
            </P>

            <Section id="score" />
            <P>
              {t("Your answers are turned into named factors, each worth a number of points.")}{" "}
              {t("Each type of cover spreads 100 points across seven categories differently.")}{" "}
              {t("Motor puts the most weight on claims and driving behaviour, for example, and health on lifestyle.")}{" "}
              {t("The total is scaled to a score from 0 to 100.")}
            </P>
            <Table
              head={[t("Cover"), ...WEIGHT_COLS.map((c) => t(c))]}
              rows={WEIGHTS.map(([name, w]) => [t(name), ...w.map((v) => (v === 0 ? "–" : v))])}
            />
            <P>
              {t("Protective factors, such as a clean record or an anti-theft device, subtract points and can take a category below zero, so they offset risk elsewhere.")}{" "}
              {t("Bands: 0–20 very low, 21–40 low, 41–60 moderate, 61–80 high, 81–100 very high.")}{" "}
              {t("Weights were set by hand from how Indian insurers describe their rating factors.")}{" "}
              {t("They haven't been fitted to real claims data, which isn't publicly available.")}
            </P>

            <Section id="premium" />
            <P>
              {t("The premium starts from a base price for the type of cover and is adjusted by a series of multipliers. For motor, the no-claim bonus then comes off the own-damage part and a fixed third-party amount is added at the end.")}
            </P>
            <pre className="mt-5 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-6 text-fg-muted">
{`premium = base × risk × cover level × city × claim history × deductible × consistency
          × (1 − no-claim bonus)          motor only, on own damage
        + third-party                     motor only`}
            </pre>
            <Table
              head={[t("Cover"), t("Base price")]}
              rows={[
                [t("Motor"), t("2.2% of IDV for cars, 2.8% for two-wheelers, 2.6% for commercial vehicles, before the no-claim bonus")],
                [t("Health"), t("₹9,000 × an age curve (×1.15 at 30, ×4.2 at 60), +25% per family member on floaters")],
                [t("Term life"), t("Published per-crore rate for your age, scaled to your cover and term; ×1.5 for smokers")],
                [t("Home"), t("0.08% of rebuilding value")],
              ]}
            />
            <Table
              head={[t("Multiplier"), t("Range"), t("Set by")]}
              rows={[
                [t("Risk"), "0.90 – 1.60", t("Risk score; below 1.00 when protective factors outweigh risky ones")],
                [t("Cover level"), "0.85 – 1.40", t("Basic to comprehensive")],
                [t("City"), "0.90 – 1.20", t("Traffic and theft (motor), flood and quake (home), treatment cost (health)")],
                [t("Claim history"), "0.95 – 1.42", t("0.95 is the no-claim discount for health and home. Motor uses the no-claim bonus instead.")],
                [t("Deductible"), "0.60 – 1.00", t("Higher voluntary deductible, lower premium")],
                [t("Consistency"), "1.00 – 1.15", t("Answers an insurer would want to verify")],
              ]}
            />
            <P>
              {t("Motor third-party premiums are set by IRDAI by engine size and are the same at every insurer: ₹2,094 up to 1000cc, ₹3,416 for 1001–1500cc and ₹7,897 above 1500cc for cars, and ₹538 to ₹2,804 for two-wheelers.")}{" "}
              {t("These rates date from 2019.")}{" "}
              {t("A revision was proposed for 2026–27 but hadn't been notified as of April 2026.")}{" "}
              {t("All premiums shown exclude 18% GST.")}
            </P>
            <P>
              {t("The base prices were calibrated so that a typical low-risk profile of each kind lands inside the published market range below.")}{" "}
              {t("Higher-risk profiles land above it, as they would with a real insurer.")}
            </P>

            <Section id="motor" />
            <P>
              {t("The motor base price is a share of the insured declared value (IDV), the most the insurer would pay if the vehicle were stolen or written off.")}{" "}
              {t("The IDV is the ex-showroom price less depreciation for the vehicle's age, on the schedule insurers apply from the India Motor Tariff.")}
            </P>
            <Table
              head={[t("Age of vehicle"), t("Depreciation")]}
              rows={[
                [t("Up to 6 months"), "5%"],
                [t("6 months to 1 year"), "15%"],
                [t("1 to 2 years"), "20%"],
                [t("2 to 3 years"), "30%"],
                [t("3 to 4 years"), "40%"],
                [t("4 to 5 years"), "50%"],
                [t("Over 5 years"), t("Agreed with the insurer")],
              ]}
            />
            <P>
              {t("Over 5 years there's no schedule.")}{" "}
              {t("The IDV is agreed between you and the insurer, so the form asks for it directly.")}
            </P>
            <P>
              {t("The no-claim bonus (NCB) is a discount on the own-damage premium only, never on third-party. It rises with each consecutive claim-free year.")}
            </P>
            <Table
              head={[t("Claim-free years"), t("No-claim bonus")]}
              rows={[
                ["1", "20%"],
                ["2", "25%"],
                ["3", "35%"],
                ["4", "45%"],
                [t("5 or more"), "50%"],
              ]}
            />
            <P>
              {t("One claim resets it to 0 unless the policy has NCB protection.")}{" "}
              {t("It belongs to the owner, not the vehicle, so it transfers to a new vehicle.")}{" "}
              {t("It lapses if the policy isn't renewed within 90 days of expiry.")}
            </P>
            <SourceList items={MOTOR_SOURCES} />

            <Section id="tax" />
            <P>
              {t("The Income-tax Act, 2025 applies from 1 April 2026 (FY 2026-27) and renumbers the deductions for insurance premiums.")}{" "}
              {t("Health and term-life estimates show how much tax the premium could save.")}
            </P>
            <Table
              head={[t("Cover"), t("Section"), t("Deduction")]}
              rows={[
                [t("Health"), t("Section 126 (formerly 80D)"), t("Up to ₹25,000 for self, spouse and children; ₹50,000 if a senior citizen (60+) is covered")],
                [t("Term life"), t("Section 123 with Schedule XV (formerly 80C)"), t("Up to ₹1.5 lakh a year, shared with PF, PPF, ELSS and others")],
                [t("Motor, home"), "–", t("None for personal use")],
              ]}
            />
            <P>
              {t("Premiums for parents have a separate limit of ₹25,000, or ₹50,000 for senior parents. That isn't included in the estimate, which covers your own policy.")}{" "}
              {t("Preventive health check-ups up to ₹5,000 count within these limits.")}{" "}
              {t("Cash payments don't qualify, except for check-ups.")}{" "}
              {t("For life policies issued after 1 April 2012, only premium up to 10% of the sum assured counts.")}
            </P>
            <P>
              {t("Both deductions exist only under the old regime. The new regime, which is the default, doesn't allow them.")}
            </P>
            <P>
              {t("To work out the saving, the premium including 18% GST is capped at the limit, and tax is calculated under the old-regime slabs for FY 2026-27 with and without the deduction. The saving is the difference.")}
            </P>
            <Table
              head={[t("Taxable income"), t("Rate")]}
              rows={[
                [t("Up to ₹2.5 lakh"), t("Nil")],
                [t("₹2.5 lakh to ₹5 lakh"), "5%"],
                [t("₹5 lakh to ₹10 lakh"), "20%"],
                [t("Above ₹10 lakh"), "30%"],
              ]}
            />
            <P>
              {t("The exemption limit is ₹3 lakh at ages 60–79 and ₹5 lakh at 80 and above.")}{" "}
              {t("The calculation assumes salaried income with the ₹50,000 standard deduction and no other deductions. It applies the ₹12,500 rebate up to ₹5 lakh of taxable income (Section 156, formerly 87A), surcharge above ₹50 lakh, and 4% cess.")}{" "}
              {t("If you already use the ₹1.5 lakh Section 123 limit elsewhere, the life premium saves nothing extra.")}
            </P>
            <P>{t("This is a general estimate, not tax advice.")}</P>
            <SourceList items={TAX_SOURCES} />

            <Section id="sources" />
            <P>
              {t("Your estimate is compared with premium ranges published by insurers and comparison sites.")}{" "}
              {t("They're broad, directional ranges, not live quotes, and sources differ on whether GST is included.")}{" "}
              {t("Where no reliable range exists, as with commercial vehicles, the estimate says so rather than showing one.")}
            </P>
            <SourceList items={SOURCES} />

            <Section id="insurers" />
            <P>
              {t("The Compare insurers page shows claim settlement ratios and incurred claim ratios for FY 2024-25, compiled from IRDAI's handbook and insurers' public disclosures.")}{" "}
              {t("Insurers are listed in the order of the column you choose. The order is not a recommendation.")}
            </P>
            <P>
              <Link to="/compare" className="text-accent-text hover:underline">{t("Compare insurers")}</Link>
            </P>

            <Section id="fairness" />
            <P>
              {t("Gender, religion, caste and marital status don't change the price.")}{" "}
              {t("For term life the form asks for sex only to pick the matching published rate table for the market comparison, because that's how insurers publish those tables.")}{" "}
              {t("The price itself uses the average of the male and female rates.")}{" "}
              {t("Age is used the way insurers use it: steadily rising for health and life, and higher for very young and very old drivers.")}
            </P>

            <Section id="ai" />
            <P>
              {t("The six preset questions on the Ask page are answered on our server from your estimate.")}{" "}
              {t("Nothing is sent anywhere else.")}{" "}
              {t("Questions you type yourself go to Google's Gemini model, which needs you to be signed in.")}
            </P>
            <P>
              {t("With each typed question, Gemini receives your age band (for example 30–34), city, number of dependents, cover details, risk factors, premium breakdown, market range and suggested changes.")}{" "}
              {t("It doesn't receive your name, email, exact age, income or the names of any medical conditions.")}{" "}
              {t("It's told to stick to those numbers, call the premium an estimate, and never suggest wrongdoing.")}{" "}
              {t("If you've chosen a language other than English, Gemini is asked to answer in that language.")}
            </P>
            <P>
              {t("If a site runs on Gemini's free tier, Google's terms allow it to use questions and answers to improve its products, and human reviewers may read them.")}{" "}
              {t("That's why the Ask page asks you not to type personal details, and says when the free tier is in use.")}
            </P>

            <Section id="privacy" />
            <P>
              {t("You don't need an account to get an estimate.")}{" "}
              {t("Estimates made without signing in aren't stored on our server; they stay in your browser tab until you close it.")}
            </P>
            <Table
              head={[t("If you sign in, we store"), t("Why"), t("Kept")]}
              rows={[
                [t("Email, name, Google profile photo"), t("Your account"), t("Until you delete it")],
                [t("Your name and when you accepted the terms"), t("Your account"), t("Until you delete it")],
                [t("Your saved estimates (answers and results)"), t("So you can reopen them"), t("Until you delete them")],
                [t("Session record: hashed token, browser, IP address"), t("Keeping you signed in securely"), t("30 days after your last visit")],
                [t("Sign-in codes (hashed) and the email and IP they were requested from"), t("Email sign-in and abuse limits"), t("About a day")],
                [t("Two-factor secret (encrypted) and recovery codes (hashed)"), t("Authenticator-app sign-in, if you turn it on"), t("Until you turn it off or delete your account")],
                [t("A count of AI questions asked"), t("Daily limit"), t("Until you delete your account")],
              ]}
            />
            <P>
              {t("We don't store the text of your AI questions, don't use analytics or advertising trackers, and set a single cookie to keep you signed in.")}{" "}
              {t("You can delete any saved estimate, or your whole account and everything in it, from the")}{" "}
              <Link to="/account/security" className="text-accent-text hover:underline">{t("account and security page")}</Link>.
            </P>

            <Section id="languages" />
            <P>
              {t("The site is available in {en}, {hi}, {mr}, {ta}, {te} and {kn}.", {
                en: "English",
                hi: native("hi"),
                mr: native("mr"),
                ta: native("ta"),
                te: native("te"),
                kn: native("kn"),
              })}{" "}
              {t("Translations were drafted with AI assistance using a fixed glossary and are stored with the site, not generated on the fly. Insurance terms such as IDV and NCB are kept in English where that's how they appear on policy documents.")}{" "}
              {t("If a translation reads awkwardly or is wrong, the English version is the reference.")}
            </P>

            <Section id="limits" />
            <ul className="mt-4 list-disc space-y-2 pl-5 text-md leading-7 text-fg-muted marker:text-fg-subtle">
              <li>{t("City risk levels cover 20 cities and are relative ratings, not published indices.")}</li>
              <li>{t("Risk weights are set by hand, not learned from real claims.")}</li>
              <li>{t("Market ranges are broad and don't adjust for every detail of your profile.")}</li>
              <li>{t("Insurers' medical underwriting, waiting periods, add-ons and discounts vary and aren't modelled in detail.")}</li>
              <li>{t("Tax savings assume salaried income with no other deductions.")}</li>
              <li>{t("Insurer claim figures are for one financial year and don't show claim turnaround time or complaints.")}</li>
              <li>{t("The insurer workspace runs on synthetic sample data, not real customers.")}</li>
            </ul>
            <P>
              {t("Before buying, compare real quotes from insurers or an IRDAI-registered web aggregator, and read the policy wording, especially exclusions and waiting periods.")}
            </P>
          </article>
        </div>
      </div>
    </MarketingLayout>
  );
}
