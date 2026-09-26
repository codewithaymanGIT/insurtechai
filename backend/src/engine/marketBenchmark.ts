// ============================================================================
// Market benchmark — compares the platform's own computed premium against
// REAL, PUBLICLY PUBLISHED Indian insurance premium ranges, cited below.
// This is the one place in the engine that consumes external data rather
// than the platform's own synthetic weights, precisely so a user can see
// whether the illustrative number they were given is in the same ballpark
// as what insurers actually publish — not just internally consistent with
// itself.
//
// All figures were sourced 2026-09-21. Insurer pricing changes constantly —
// these are directional reference bands, not live rates, and are labeled as
// such everywhere they are surfaced. Where no reliable published range could
// be found for a segment (e.g. commercial-vehicle comprehensive premiums),
// this module honestly reports "unknown" rather than inventing one.
// ============================================================================

import { ApplicantProfile, MarketBenchmark, MarketBenchmarkSource } from "@insurtechai/shared";
import { tr } from "../i18n";

const SRC = {
  nivaBupaHealth: { label: "Niva Bupa · Average health insurance premium in India (2025)", url: "https://www.nivabupa.com/health-insurance-articles/what-is-the-average-health-insurance-premium-in-india.html" },
  hdfcErgoHealth: { label: "HDFC ERGO · Average health insurance cost in India", url: "https://www.hdfcergo.com/blogs/health-insurance/average-health-insurance-cost-in-india" },
  nyvoTermLife: { label: "Nyvo · ₹1 crore term insurance premiums by age (2026)", url: "https://nyvo.in/term-insurance/1-crore-cost-breakdown" },
  forbesCar: { label: "Forbes Advisor India · Average cost of car insurance (2026)", url: "https://www.forbes.com/advisor/in/car-insurance/average-cost-of-car-insurance/" },
  insure24Bike: { label: "Insure24 · Comprehensive two-wheeler insurance in India (2026)", url: "https://www.insure24.com/blog/comprehensive-bike-insurance-india/" },
  smcHome: { label: "SMC Insurance · Home insurance cost by property value (2026)", url: "https://www.smcinsurance.com/home-insurance/articles/how-much-does-home-insurance-cost" },
} satisfies Record<string, MarketBenchmarkSource>;

function position(final: number, low: number, high: number): "below" | "within" | "above" {
  // Strict: the verdict quotes the range, so "within" must be literally true.
  if (final < low) return "below";
  if (final > high) return "above";
  return "within";
}

// ---------------------------------------------------------------------------
// LIFE — term insurance, ₹1 crore reference table (non-smoker), scaled
// linearly by coverage amount (term-life premium is very close to linear in
// sum assured for a fixed age/term). Source: Nyvo, ages 25-45.
// ---------------------------------------------------------------------------
const TERM_PER_CRORE_NON_SMOKER: { age: number; male: number; female: number }[] = [
  { age: 25, male: 8628, female: 7332 },
  { age: 30, male: 9528, female: 8100 },
  { age: 35, male: 11880, female: 10104 },
  { age: 40, male: 15852, female: 13476 },
  { age: 45, male: 22008, female: 18708 },
];

/** Gender-neutral (male/female average) non-smoker ₹/year per ₹1 crore of
 * term cover. Used by the pricing engine, which deliberately doesn't price
 * on gender; the gendered table is only used for the market comparison. */
export function neutralTermRatePerCrore(age: number): number {
  return (interpolatePerCrore(age, "MALE") + interpolatePerCrore(age, "FEMALE")) / 2;
}

function interpolatePerCrore(age: number, gender: string): number {
  const table = TERM_PER_CRORE_NON_SMOKER;
  const key = gender === "FEMALE" ? "female" : "male"; // published table only splits male/female
  if (age <= table[0].age) return table[0][key];
  if (age >= table[table.length - 1].age) return table[table.length - 1][key] * 1.35; // 45+ rises faster than the linear trend below it
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i], b = table[i + 1];
    if (age >= a.age && age <= b.age) {
      const t = (age - a.age) / (b.age - a.age);
      return a[key] + (b[key] - a[key]) * t;
    }
  }
  return table[2][key];
}

function lifeBenchmark(a: ApplicantProfile): MarketBenchmark {
  if (!a.life) return unknownBenchmark();
  const perCrore = interpolatePerCrore(a.personal.age, a.personal.gender);
  const smokerMultiplier = a.life.smoker ? 1.5 : 1.0; // insurers commonly load 40-60%; midpoint used
  const median = Math.round((perCrore * smokerMultiplier * a.life.coverageAmount) / 10000000);
  return {
    applicable: true,
    lowInr: Math.round(median * 0.85),
    medianInr: median,
    highInr: Math.round(median * 1.2),
    position: "unknown",
    basis: a.life.smoker
      ? tr("Published term rates for a {age}-year-old smoker, scaled to your cover. Actual quotes depend on each insurer's medical checks.", { age: a.personal.age })
      : tr("Published term rates for a {age}-year-old, scaled to your cover. Actual quotes depend on each insurer's medical checks.", { age: a.personal.age }),
    sources: [SRC.nyvoTermLife],
  };
}

// ---------------------------------------------------------------------------
// MOTOR — comprehensive premium bands by vehicle type. Source: Forbes
// Advisor (four-wheelers), Insure24 (two-wheelers). No reliable published
// range found for COMMERCIAL vehicles — reported as not applicable rather
// than guessed.
// ---------------------------------------------------------------------------
const MOTOR_BANDS: Record<string, { low: number; high: number; source: MarketBenchmarkSource } | null> = {
  TWO_WHEELER: { low: 1200, high: 5500, source: SRC.insure24Bike },
  HATCHBACK: { low: 7000, high: 15000, source: SRC.forbesCar },
  SEDAN: { low: 10000, high: 20000, source: SRC.forbesCar },
  SUV: { low: 15000, high: 30000, source: SRC.forbesCar },
  COMMERCIAL: null,
};

function motorBasis(vehicleType: string): string {
  switch (vehicleType) {
    case "TWO_WHEELER": return tr("Typical published comprehensive premium range for a two-wheeler in India. It doesn't adjust for your vehicle's value or city.");
    case "HATCHBACK": return tr("Typical published comprehensive premium range for a hatchback in India. It doesn't adjust for your vehicle's value or city.");
    case "SEDAN": return tr("Typical published comprehensive premium range for a sedan in India. It doesn't adjust for your vehicle's value or city.");
    case "SUV": return tr("Typical published comprehensive premium range for an SUV in India. It doesn't adjust for your vehicle's value or city.");
    default: return tr("Typical published comprehensive premium range for this vehicle type in India. It doesn't adjust for your vehicle's value or city.");
  }
}

function motorBenchmark(a: ApplicantProfile): MarketBenchmark {
  if (!a.motor) return unknownBenchmark();
  const band = MOTOR_BANDS[a.motor.vehicleType];
  if (!band) {
    return {
      applicable: false, lowInr: null, medianInr: null, highInr: null, position: "unknown",
      basis: tr("There's no reliable published range for commercial vehicles. Their premiums depend too much on tonnage, use and route to compare fairly."),
      sources: [],
    };
  }
  return {
    applicable: true,
    lowInr: band.low,
    medianInr: Math.round((band.low + band.high) / 2),
    highInr: band.high,
    position: "unknown",
    basis: motorBasis(a.motor.vehicleType),
    sources: [band.source],
  };
}

// ---------------------------------------------------------------------------
// PROPERTY — comprehensive building+contents premium by property value band.
// Source: SMC Insurance.
// ---------------------------------------------------------------------------
const PROPERTY_BANDS: { max: number; low: number; high: number }[] = [
  { max: 1500000, low: 300, high: 2000 },
  { max: 4000000, low: 2500, high: 4000 },
  { max: 7500000, low: 4000, high: 7000 },
  { max: Infinity, low: 7000, high: 10000 },
];

function propertyBenchmark(a: ApplicantProfile): MarketBenchmark {
  if (!a.property) return unknownBenchmark();
  const band = PROPERTY_BANDS.find((b) => a.property!.propertyValue <= b.max) ?? PROPERTY_BANDS[PROPERTY_BANDS.length - 1];
  return {
    applicable: true,
    lowInr: band.low,
    medianInr: Math.round((band.low + band.high) / 2),
    highInr: band.high,
    position: "unknown",
    basis: tr("Typical published home-insurance premiums for a property worth around ₹{lakh} lakh.", { lakh: (a.property.propertyValue / 100000).toFixed(1) }),
    sources: [SRC.smcHome],
  };
}

// ---------------------------------------------------------------------------
// HEALTH — individual / family floater / senior bands. Source: HDFC ERGO,
// Niva Bupa. These are the least precise published ranges (no insurer
// publishes a clean rate table by sum-insured and age), so the band is
// widened accordingly and labeled as approximate.
// ---------------------------------------------------------------------------
function healthBenchmark(a: ApplicantProfile): MarketBenchmark {
  if (!a.health) return unknownBenchmark();
  const seniorBand = a.personal.age >= 60;
  const familyBand = a.personal.dependents >= 2;
  if (seniorBand) {
    return { applicable: true, lowInr: 35000, medianInr: 47000, highInr: 60000, position: "unknown", basis: tr("Typical published premiums for individual senior-citizen health plans (age 60+)."), sources: [SRC.hdfcErgoHealth] };
  }
  if (familyBand) {
    return { applicable: true, lowInr: 18000, medianInr: 24000, highInr: 30000, position: "unknown", basis: tr("Typical published premiums for family floater plans."), sources: [SRC.hdfcErgoHealth, SRC.nivaBupaHealth] };
  }
  return { applicable: true, lowInr: 8000, medianInr: 16500, highInr: 25000, position: "unknown", basis: tr("Typical published premiums for an individual plan with ₹5–10 lakh cover."), sources: [SRC.hdfcErgoHealth, SRC.nivaBupaHealth] };
}

function unknownBenchmark(): MarketBenchmark {
  return { applicable: false, lowInr: null, medianInr: null, highInr: null, position: "unknown", basis: tr("No applicant profile available to benchmark."), sources: [] };
}

export function getMarketBenchmark(applicant: ApplicantProfile, finalPremiumInr: number): MarketBenchmark {
  const benchmark = (() => {
    switch (applicant.policy.insuranceType) {
      case "LIFE": return lifeBenchmark(applicant);
      case "MOTOR": return motorBenchmark(applicant);
      case "PROPERTY": return propertyBenchmark(applicant);
      case "HEALTH": return healthBenchmark(applicant);
    }
  })();
  if (!benchmark.applicable || benchmark.lowInr == null || benchmark.highInr == null) return benchmark;
  return { ...benchmark, position: position(finalPremiumInr, benchmark.lowInr, benchmark.highInr) };
}
