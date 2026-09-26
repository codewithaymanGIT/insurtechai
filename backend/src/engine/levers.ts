// ============================================================================
// Controllable "levers" — the finite set of changes an applicant can
// realistically make. Used by both the What-If Simulator (frontend passes
// an arbitrary modified profile) and the Premium Optimizer (backend tries
// every lever automatically and ranks by savings/effort).
// ============================================================================

import { ApplicantProfile, Effort, RiskFactorCategory } from "@insurtechai/shared";
import { ncbFor } from "./motorValue";
import { tr, N_ } from "../i18n";

export interface Lever {
  id: string;
  title: string;
  /** English source string, or a function that builds translated text for this applicant. */
  description: string | ((a: ApplicantProfile) => string);
  category: RiskFactorCategory;
  effort: Effort;
  appliesTo: (a: ApplicantProfile) => boolean;
  apply: (a: ApplicantProfile) => ApplicantProfile;
}

const clone = (a: ApplicantProfile): ApplicantProfile => JSON.parse(JSON.stringify(a));

export const LEVERS: Lever[] = [
  {
    id: "reduce-mileage",
    title: N_("Drive fewer kilometres"),
    description: N_("Less time on the road means fewer chances of an accident. Some insurers offer pay-as-you-drive plans for low mileage."),
    category: "Behavioral",
    effort: "Medium",
    appliesTo: (a) => !!a.motor && a.motor.annualMileageKm > 8000,
    apply: (a) => {
      const c = clone(a);
      c.motor!.annualMileageKm = Math.max(6000, Math.round(c.motor!.annualMileageKm * 0.55));
      return c;
    },
  },
  {
    id: "install-tracking-device",
    title: N_("Fit an approved anti-theft device"),
    description: N_("An ARAI-approved device lowers theft risk, and most insurers give a discount for it."),
    category: "Behavioral",
    effort: "Low",
    appliesTo: (a) => !!a.motor && !a.motor.hasTrackingDevice,
    apply: (a) => {
      const c = clone(a);
      c.motor!.hasTrackingDevice = true;
      return c;
    },
  },
  {
    id: "increase-deductible",
    title: N_("Choose a higher voluntary deductible"),
    description: N_("You pay more of each claim yourself, and the premium drops. Only worth it if you could cover that amount."),
    category: "Behavioral",
    effort: "Low",
    appliesTo: (a) => !a.life && a.policy.deductible < 50000,
    apply: (a) => {
      const c = clone(a);
      c.policy.deductible = c.policy.deductible + 25000;
      return c;
    },
  },
  {
    id: "install-security-system",
    title: N_("Add a monitored security system"),
    description: N_("Alarms and monitored CCTV lower burglary risk."),
    category: "Behavioral",
    effort: "Medium",
    appliesTo: (a) => !!a.property && !a.property.hasSecuritySystem,
    apply: (a) => {
      const c = clone(a);
      c.property!.hasSecuritySystem = true;
      return c;
    },
  },
  {
    id: "quit-smoking",
    title: N_("Quit smoking"),
    description: N_("Most insurers re-rate you as a non-smoker after 12 months without tobacco."),
    category: "Lifestyle",
    effort: "High",
    appliesTo: (a) => !!a.health && a.health.smoker,
    apply: (a) => {
      const c = clone(a);
      c.health!.smoker = false;
      return c;
    },
  },
  {
    id: "improve-exercise",
    title: N_("Exercise regularly"),
    description: N_("Several insurers now reward regular activity with renewal discounts."),
    category: "Lifestyle",
    effort: "Medium",
    appliesTo: (a) => !!a.health && (a.health.exerciseFrequency === "NONE" || a.health.exerciseFrequency === "OCCASIONAL"),
    apply: (a) => {
      const c = clone(a);
      c.health!.exerciseFrequency = "REGULAR";
      return c;
    },
  },
  {
    id: "reduce-alcohol",
    title: N_("Drink less"),
    description: N_("Cutting back lowers long-term health risk."),
    category: "Lifestyle",
    effort: "High",
    appliesTo: (a) => !!a.health && (a.health.alcoholUse === "HEAVY" || a.health.alcoholUse === "MODERATE"),
    apply: (a) => {
      const c = clone(a);
      c.health!.alcoholUse = "OCCASIONAL";
      return c;
    },
  },
  {
    id: "renew-without-claim",
    title: N_("Renew without claiming"),
    description: (a) => {
      const now = ncbFor(a.motor?.claimFreeYears);
      return tr("Your no-claim bonus on the own-damage part goes from {from}% to {to}% at the next renewal. Paying for a small repair yourself can be cheaper than losing it.", { from: now, to: ncbFor((a.motor?.claimFreeYears ?? 0) + 1) });
    },
    category: "HistoricalClaims",
    effort: "Medium",
    appliesTo: (a) => !!a.motor && (a.motor.claimFreeYears ?? 0) < 5,
    apply: (a) => {
      const c = clone(a);
      c.motor!.claimFreeYears = (c.motor!.claimFreeYears ?? 0) + 1;
      return c;
    },
  },
  {
    id: "maintain-claim-free",
    title: N_("Stay claim-free"),
    description: N_("A year without claims usually brings a no-claim discount or bonus at renewal."),
    category: "HistoricalClaims",
    effort: "High",
    appliesTo: (a) => !a.motor && typeof a.claimsLast12Months === "number" && a.claimsLast12Months > 0,
    apply: (a) => {
      const c = clone(a);
      c.claimsLast12Months = 0;
      return c;
    },
  },
];
