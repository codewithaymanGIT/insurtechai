import { describe, expect, it } from "vitest";
import { depreciationFor, idvFromExShowroom, ncbFor, vehicleAgeStep } from "@insurtechai/shared";
import { runFullAssessment } from "../src/engine/assess";
import { motor } from "./fixtures";

describe("IDV depreciation schedule", () => {
  it.each([
    [0, 5], [0.5, 15], [1, 20], [2, 30], [3, 40], [4, 50],
  ])("age step %s depreciates %s%%", (age, pct) => {
    expect(depreciationFor(age)?.percent).toBe(pct);
  });

  it("has no schedule from 5 years", () => {
    expect(depreciationFor(5)).toBeNull();
    expect(idvFromExShowroom(1000000, 7)).toBeNull();
  });

  it("rounds the IDV to ₹100", () => {
    expect(idvFromExShowroom(1234567, 2)).toBe(864200);
  });

  it("snaps any age to the form's steps", () => {
    expect([0, 0.3, 0.7, 1.9, 4.99, 12].map(vehicleAgeStep)).toEqual([0, 0, 0.5, 1, 4, 5]);
  });
});

describe("no-claim bonus", () => {
  it("follows the 0/20/25/35/45/50 slabs and caps at 5 years", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(ncbFor)).toEqual([0, 20, 25, 35, 45, 50, 50]);
  });

  it("discounts only the own-damage part, never third-party", () => {
    const none = runFullAssessment(motor({ claimFreeYears: 0 })).premium;
    const max = runFullAssessment(motor({ claimFreeYears: 5 })).premium;
    expect(max.fixedPremium).toBe(none.fixedPremium);
    const odNone = none.finalPremium - none.fixedPremium;
    const odMax = max.finalPremium - max.fixedPremium;
    expect(odMax).toBeCloseTo(odNone * 0.5, -1); // within ₹10 rounding
  });
});

describe("premium engine", () => {
  it("replaces the entered IDV with the schedule value", () => {
    const r = runFullAssessment(motor({ vehicleValue: 123 }));
    expect(r.motorValue?.idv).toBe(700000);
    expect(r.motorValue?.depreciationPercent).toBe(30);
  });

  it.each([
    ["SEDAN", 999, 2094], ["SEDAN", 1200, 3416], ["SUV", 1998, 7897],
    ["TWO_WHEELER", 75, 538], ["TWO_WHEELER", 150, 714], ["TWO_WHEELER", 350, 1366], ["TWO_WHEELER", 650, 2804],
  ] as const)("uses the IRDAI third-party rate for a %s of %scc", (vehicleType, engineCapacityCC, rate) => {
    expect(runFullAssessment(motor({ vehicleType, engineCapacityCC })).premium.fixedPremium).toBe(rate);
  });

  it("only calls a premium 'within' the range when it literally is", () => {
    for (const age of [0, 2, 4]) {
      for (const cfy of [0, 5]) {
        const { decisionSummary: ds, premium } = runFullAssessment(motor({ vehicleAgeYears: age, claimFreeYears: cfy }));
        const b = ds.benchmark;
        if (b.position === "within") {
          expect(premium.finalPremium).toBeGreaterThanOrEqual(b.lowInr!);
          expect(premium.finalPremium).toBeLessThanOrEqual(b.highInr!);
        }
      }
    }
  });

  it("flags a claim-free record that contradicts a recent claim", () => {
    const a = { ...motor({ claimFreeYears: 3 }), claimsLast12Months: 1 };
    expect(runFullAssessment(a).fraud.signals.map((s) => s.code)).toContain("NCB_CONFLICT");
  });
});
