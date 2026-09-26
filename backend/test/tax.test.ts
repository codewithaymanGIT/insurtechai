import { describe, expect, it } from "vitest";
import type { PremiumBreakdown } from "@insurtechai/shared";
import { computeTaxBenefit } from "../src/engine/taxBenefit";
import { runFullAssessment } from "../src/engine/assess";
import { health, life, motor } from "./fixtures";

const premium = (finalPremium: number) => ({ finalPremium }) as PremiumBreakdown;

describe("Section 126 (health, formerly 80D)", () => {
  it("deducts the GST-inclusive premium and saves tax at the 30% slab plus cess", () => {
    const t = computeTaxBenefit(health(32, 1800000), premium(15000));
    expect(t.premiumPaid).toBe(17700);
    expect(t.deduction).toBe(17700);
    expect(t.limit).toBe(25000);
    expect(t.savedOldRegime).toBe(Math.round(17700 * 0.3 * 1.04));
  });

  it("caps at ₹25,000, or ₹50,000 for a senior citizen", () => {
    expect(computeTaxBenefit(health(40, 1800000), premium(40000)).deduction).toBe(25000);
    expect(computeTaxBenefit(health(65, 1800000), premium(60000)).deduction).toBe(50000);
  });

  it("saves nothing when the rebate already makes tax zero", () => {
    const t = computeTaxBenefit(health(32, 500000), premium(15000));
    expect(t.applicable).toBe(true);
    expect(t.savedOldRegime).toBe(0);
  });

  it("taxes the 5–10 lakh slab at 20%", () => {
    const t = computeTaxBenefit(health(32, 900000), premium(10000));
    expect(t.savedOldRegime).toBe(Math.round(11800 * 0.2 * 1.04));
  });
});

describe("Section 123 (term life, formerly 80C)", () => {
  it("counts premium only up to 10% of the sum assured", () => {
    expect(computeTaxBenefit(life(1000000, 3000000), premium(200000)).deduction).toBe(100000);
  });

  it("caps at ₹1.5 lakh", () => {
    expect(computeTaxBenefit(life(50000000, 3000000), premium(200000)).deduction).toBe(150000);
  });
});

it("gives no deduction for motor", () => {
  expect(runFullAssessment(motor()).tax.applicable).toBe(false);
});
