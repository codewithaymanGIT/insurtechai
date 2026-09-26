import { describe, expect, it } from "vitest";
import report from "../../data/frequency-report.json";
import { drivAgeBand, score, vehAgeBand, type Policy, type RatingTable } from "../frequencyModel";

const table = report.glm.ratingTable as unknown as RatingTable;
const checks = (report as unknown as { calculatorChecks: (Policy & { frequency: number })[] }).calculatorChecks;

describe("GLM rating table in the browser", () => {
  it("reproduces statsmodels' predictions for held-out policies", () => {
    expect(checks.length).toBeGreaterThan(0);
    for (const { frequency, ...policy } of checks) {
      expect(score(table, policy as Policy).frequency).toBeCloseTo(frequency, 6);
    }
  });

  it("bands ages the same way as the Python features", () => {
    expect([18, 20, 21, 25, 26, 40, 41, 50, 70, 71, 95].map(drivAgeBand)).toEqual(
      ["18-20", "18-20", "21-25", "21-25", "26-30", "31-40", "41-50", "41-50", "51-70", "71+", "71+"],
    );
    expect([0, 1, 10, 11, 30].map(vehAgeBand)).toEqual(["0", "1-10", "1-10", "11+", "11+"]);
  });

  it("raises the frequency as bonus-malus worsens", () => {
    const base: Policy = { DrivAge: 40, VehAge: 5, VehPower: 6, BonusMalus: 50, Density: 300, Area: "C", VehBrand: "B1", VehGas: "Regular", Region: "Centre" };
    const levels = [50, 70, 90, 110, 150].map((bm) => score(table, { ...base, BonusMalus: bm }).frequency);
    levels.slice(1).forEach((f, i) => expect(f).toBeGreaterThan(levels[i]));
  });

  it("multiplies out to the reported frequency", () => {
    const p: Policy = { DrivAge: 23, VehAge: 0, VehPower: 11, BonusMalus: 90, Density: 5000, Area: "E", VehBrand: "B12", VehGas: "Diesel", Region: "Ile-de-France" };
    const { frequency, terms } = score(table, p);
    const base: Policy = { DrivAge: 45, VehAge: 5, VehPower: 6, BonusMalus: 50, Density: 100, Area: "C", VehBrand: "B1", VehGas: "Regular", Region: "Centre" };
    const product = terms.reduce((m, t) => m * t.multiplier, 1);
    expect(frequency / score(table, base).frequency).toBeCloseTo(product, 9);
  });
});
