// ============================================================================
// Income-tax deduction for the premium under the Income-tax Act, 2025, in
// force from 1 April 2026 (FY 2026-27):
//   - Health: Section 126 (was 80D). ₹25,000 for self/family, ₹50,000 if a
//     senior citizen is insured; parents have a separate limit (not modelled:
//     this estimate covers the applicant's own policy). Not available under
//     the new regime.
//   - Life: Section 123 with Schedule XV (was 80C). Up to ₹1.5 lakh, shared
//     with PF, ELSS etc.; premium above 10% of the sum assured doesn't count
//     for policies issued after 1 April 2012. Not available under the new
//     regime.
// Tax saved is computed under the old regime (FY 2026-27 slabs, unchanged by
// Budget 2026), assuming salaried income with the ₹50,000 standard deduction
// and no other deductions, with the ₹12,500 rebate up to ₹5 lakh, surcharge
// tiers (without marginal relief) and 4% cess.
// Sources: incometaxindia.gov.in (Section 126, Schedule XV, tax rates),
// Business Today (Section 123, Budget 2026 slabs). See Methodology.
// ============================================================================

import { ApplicantProfile, PremiumBreakdown, TaxBenefit } from "@insurtechai/shared";
import { tr } from "../i18n";

const GST = 0.18;

function oldRegimeTax(taxable: number, age: number): number {
  const exempt = age >= 80 ? 500000 : age >= 60 ? 300000 : 250000;
  const x = Math.max(0, taxable);
  let tax = 0;
  if (x > exempt) tax += (Math.min(x, 500000) - exempt) * 0.05;
  if (x > 500000) tax += (Math.min(x, 1000000) - 500000) * 0.2;
  if (x > 1000000) tax += (x - 1000000) * 0.3;
  if (x <= 500000) tax = Math.max(0, tax - 12500); // rebate (Section 156, was 87A)
  const surcharge = x > 5e7 ? 0.37 : x > 2e7 ? 0.25 : x > 1e7 ? 0.15 : x > 5e6 ? 0.1 : 0;
  return tax * (1 + surcharge) * 1.04;
}

function marginalRate(taxable: number, age: number): number {
  const exempt = age >= 80 ? 500000 : age >= 60 ? 300000 : 250000;
  if (taxable <= 500000) return 0; // rebate wipes out the tax
  const base = taxable > 1000000 ? 30 : taxable > 500000 ? 20 : taxable > exempt ? 5 : 0;
  return Math.round(base * 1.04 * 10) / 10;
}

export function computeTaxBenefit(a: ApplicantProfile, premium: PremiumBreakdown): TaxBenefit {
  const premiumPaid = Math.round(premium.finalPremium * (1 + GST));
  const none = (note: string): TaxBenefit => ({
    applicable: false, section: null, premiumPaid, deduction: 0, limit: null, savedOldRegime: 0, marginalRatePercent: 0, notes: [note],
  });

  if (a.policy.insuranceType === "MOTOR" || a.policy.insuranceType === "PROPERTY") {
    return none(tr("Motor and home insurance premiums for personal use don't qualify for an income-tax deduction."));
  }

  const age = a.personal.age;
  const taxableBefore = Math.max(0, a.personal.annualIncome - 50000);
  let deduction = 0;
  let limit = 0;
  let section = "";
  const notes: string[] = [];

  if (a.policy.insuranceType === "HEALTH") {
    section = tr("Section 126 (formerly 80D)");
    limit = age >= 60 ? 50000 : 25000;
    deduction = Math.min(premiumPaid, limit);
    notes.push(
      age >= 60
        ? tr("The limit is ₹50,000 because a senior citizen is covered.")
        : tr("The limit is ₹25,000 for you, your spouse and children. Premiums you pay for your parents have a separate limit of ₹25,000, or ₹50,000 if they're 60 or older."),
    );
    notes.push(tr("Pay by UPI, card or bank transfer: premiums paid in cash don't qualify."));
  } else {
    section = tr("Section 123 (formerly 80C)");
    limit = 150000;
    const cap = a.life ? a.life.coverageAmount * 0.1 : Infinity;
    deduction = Math.min(premiumPaid, limit, cap);
    notes.push(tr("The ₹1.5 lakh limit is shared with PF, PPF, ELSS, home-loan principal and other items. If those already use it up, this premium adds nothing."));
  }

  const taxableAfter = Math.max(0, taxableBefore - deduction);
  const saved = Math.round(oldRegimeTax(taxableBefore, age) - oldRegimeTax(taxableAfter, age));
  notes.push(tr("Only under the old tax regime. The new regime, which is the default, gives no deduction for this premium."));
  if (taxableBefore <= 500000) notes.push(tr("At your income, the rebate already brings tax under the old regime to zero, so the deduction saves nothing."));

  return {
    applicable: true,
    section,
    premiumPaid,
    deduction: Math.round(deduction),
    limit,
    savedOldRegime: Math.max(0, saved),
    marginalRatePercent: marginalRate(taxableBefore, age),
    notes,
  };
}
