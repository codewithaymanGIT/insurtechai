// The Poisson GLM from ml-service/train.py, applied in the browser as the
// rating table it is: log(frequency) = intercept + one coefficient per factor
// level + the continuous terms. Banding must match
// ml-service/claims_frequency/features.py exactly; the unit test checks it
// against statsmodels' own predictions.

export interface CoefRow {
  coef: number;
  lo: number;
  hi: number;
}

export interface RatingTable {
  intercept: number;
  factors: Record<"DrivAgeBand" | "VehAgeBand" | "VehPowerCat" | "VehBrand" | "VehGas" | "Region", Record<string, CoefRow>>;
  continuous: { BonusMalus: number; LogBonusMalus: number; LogDensity: number; AreaCode: number };
}

export interface Policy {
  DrivAge: number;
  VehAge: number;
  VehPower: number;
  BonusMalus: number;
  Density: number;
  Area: "A" | "B" | "C" | "D" | "E" | "F";
  VehBrand: string;
  VehGas: string;
  Region: string;
}

export const AREA_CODE = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 } as const;

export function drivAgeBand(age: number): string {
  const a = Math.min(90, age);
  if (a <= 20) return "18-20";
  if (a <= 25) return "21-25";
  if (a <= 30) return "26-30";
  if (a <= 40) return "31-40";
  if (a <= 50) return "41-50";
  if (a <= 70) return "51-70";
  return "71+";
}

export function vehAgeBand(age: number): string {
  const a = Math.min(20, age);
  if (a <= 0) return "0";
  if (a <= 10) return "1-10";
  return "11+";
}

export interface Term {
  factor: string;
  level: string;
  /** exp(contribution) relative to the base level / reference value */
  multiplier: number;
}

/** Expected claims per policy-year, with each factor's multiplier. */
export function score(t: RatingTable, p: Policy): { frequency: number; terms: Term[] } {
  const bm = Math.min(150, Math.max(50, p.BonusMalus));
  const levels: [keyof RatingTable["factors"], string][] = [
    ["DrivAgeBand", drivAgeBand(p.DrivAge)],
    ["VehAgeBand", vehAgeBand(p.VehAge)],
    ["VehPowerCat", String(Math.min(9, Math.floor(Math.min(15, p.VehPower))))],
    ["VehBrand", p.VehBrand],
    ["VehGas", p.VehGas],
    ["Region", p.Region],
  ];
  const terms: Term[] = levels.map(([f, lvl]) => ({ factor: f, level: lvl, multiplier: Math.exp(t.factors[f][lvl]?.coef ?? 0) }));
  const c = t.continuous;
  // Continuous terms shown relative to a reference policy: bonus-malus 50,
  // density 100 people/km², area C.
  terms.push({ factor: "BonusMalus", level: String(bm), multiplier: Math.exp(c.BonusMalus * (bm - 50) + c.LogBonusMalus * Math.log(bm / 50)) });
  terms.push({ factor: "Density", level: String(p.Density), multiplier: Math.exp(c.LogDensity * Math.log(p.Density / 100)) });
  terms.push({ factor: "Area", level: p.Area, multiplier: Math.exp(c.AreaCode * (AREA_CODE[p.Area] - 3)) });

  const reference = t.intercept + c.BonusMalus * 50 + c.LogBonusMalus * Math.log(50) + c.LogDensity * Math.log(100) + c.AreaCode * 3;
  const frequency = Math.exp(reference) * terms.reduce((m, x) => m * x.multiplier, 1);
  return { frequency, terms };
}
