// ============================================================================
// Portfolio Analytics Dashboard aggregation.
//
// All figures are computed from the seeded/generated database rows — there
// are no hard-coded KPI numbers anywhere in this file.
// ============================================================================

import { DashboardRow, ClaimRow } from "../db/repository";
import { CustomerSegment, PortfolioKpis, RiskDistributionBucket, RiskCategory } from "@insurtechai/shared";

function parseInsuredValue(row: DashboardRow): number {
  try {
    if (row.motorProfile) return JSON.parse(row.motorProfile).vehicleValue ?? 0;
    if (row.propertyProfile) return JSON.parse(row.propertyProfile).propertyValue ?? 0;
    if (row.lifeProfile) return JSON.parse(row.lifeProfile).coverageAmount ?? 0;
  } catch {
    /* malformed JSON — ignore, treat as 0 */
  }
  return 500000; // HEALTH: nominal sum-insured proxy, no explicit field collected
}

const RISK_CATEGORIES: RiskCategory[] = ["Very Low", "Low", "Moderate", "High", "Very High"];

function toDisplayRiskCategory(dbCategory: string | null): RiskCategory {
  if (!dbCategory) return "Moderate";
  const map: Record<string, RiskCategory> = {
    VERY_LOW: "Very Low", LOW: "Low", MODERATE: "Moderate", HIGH: "High", VERY_HIGH: "Very High",
  };
  return map[dbCategory] ?? "Moderate";
}

export function computeKpis(rows: DashboardRow[], claims: ClaimRow[]): PortfolioKpis {
  const withPremium = rows.filter((r) => r.finalPremium != null);
  const totalPolicies = rows.length;
  const totalInsuredValue = rows.reduce((sum, r) => sum + parseInsuredValue(r), 0);
  const premiumRevenue = withPremium.reduce((sum, r) => sum + (r.finalPremium ?? 0), 0);
  const averagePremium = withPremium.length ? Math.round(premiumRevenue / withPremium.length) : 0;
  const riskScored = rows.filter((r) => r.riskScore != null);
  const averageRiskScore = riskScored.length
    ? Math.round((riskScored.reduce((s, r) => s + (r.riskScore ?? 0), 0) / riskScored.length) * 10) / 10
    : 0;
  const highRiskCustomers = rows.filter((r) => r.riskCategory === "HIGH" || r.riskCategory === "VERY_HIGH").length;
  const potentialAnomalies = rows.filter((r) => r.anomalyLevel === "HIGH").length;

  // premiumRevenue is an ANNUAL figure (each policy's current premium), so
  // loss ratio / claims frequency must compare against claims from the
  // trailing 12 months too — comparing against a multi-year claims history
  // would produce a meaningless (and alarmingly large) ratio.
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const trailingClaims = claims.filter((c) => new Date(c.claimDate).getTime() >= oneYearAgo);
  const trailingClaimsPaid = trailingClaims.filter((c) => c.status === "SETTLED").reduce((s, c) => s + c.claimAmount, 0);
  // Exposure = amounts on claims not yet finalized (open pipeline), not the
  // full multi-year historical claims total.
  const estimatedClaimsExposure = claims.filter((c) => c.status !== "SETTLED" && c.status !== "REJECTED").reduce((s, c) => s + c.claimAmount, 0);
  const lossRatio = premiumRevenue > 0 ? Math.round((trailingClaimsPaid / premiumRevenue) * 1000) / 10 : 0;
  const claimsFrequency = totalPolicies > 0 ? Math.round((trailingClaims.length / totalPolicies) * 100) / 100 : 0;

  return {
    totalPolicies,
    totalInsuredValue: Math.round(totalInsuredValue),
    averagePremium,
    averageRiskScore,
    highRiskCustomers,
    potentialAnomalies,
    estimatedClaimsExposure: Math.round(estimatedClaimsExposure),
    premiumRevenue: Math.round(premiumRevenue),
    lossRatio,
    claimsFrequency,
  };
}

export function riskDistribution(rows: DashboardRow[]): RiskDistributionBucket[] {
  const counts: Record<RiskCategory, number> = { "Very Low": 0, Low: 0, Moderate: 0, High: 0, "Very High": 0 };
  for (const r of rows) counts[toDisplayRiskCategory(r.riskCategory)]++;
  return RISK_CATEGORIES.map((category) => ({ category, count: counts[category] }));
}

export function premiumDistribution(rows: DashboardRow[]): { bucket: string; count: number }[] {
  const buckets = [
    { label: "0-10k", max: 10000 },
    { label: "10k-25k", max: 25000 },
    { label: "25k-50k", max: 50000 },
    { label: "50k-100k", max: 100000 },
    { label: "100k-250k", max: 250000 },
    { label: "250k+", max: Infinity },
  ];
  const counts = buckets.map((b) => ({ bucket: b.label, count: 0 }));
  for (const r of rows) {
    if (r.finalPremium == null) continue;
    const idx = buckets.findIndex((b) => r.finalPremium! <= b.max);
    counts[idx === -1 ? counts.length - 1 : idx].count++;
  }
  return counts;
}

export function claimsByMonth(claims: ClaimRow[]): { month: string; count: number; totalAmount: number }[] {
  const map = new Map<string, { count: number; totalAmount: number }>();
  for (const c of claims) {
    const month = c.claimDate.slice(0, 7); // YYYY-MM
    const entry = map.get(month) ?? { count: 0, totalAmount: 0 };
    entry.count++;
    entry.totalAmount += c.claimAmount;
    map.set(month, entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, count: v.count, totalAmount: Math.round(v.totalAmount) }));
}

export function riskVsPremium(rows: DashboardRow[]): { riskScore: number; premium: number; insuranceType: string }[] {
  return rows
    .filter((r) => r.riskScore != null && r.finalPremium != null)
    .map((r) => ({ riskScore: r.riskScore!, premium: r.finalPremium!, insuranceType: r.insuranceType }));
}

export function customerSegmentation(rows: DashboardRow[]): CustomerSegment[] {
  const counts: Record<CustomerSegment["segment"], number> = {
    "Low Risk / High Value": 0,
    "Low Risk / Low Value": 0,
    "Moderate Risk": 0,
    "High Risk": 0,
    "High Value / High Risk": 0,
    "Potential Fraud/Anomaly": 0,
  };

  for (const r of rows) {
    if (r.anomalyLevel === "HIGH") {
      counts["Potential Fraud/Anomaly"]++;
      continue;
    }
    const insuredValue = parseInsuredValue(r);
    const isHighValue = insuredValue > 1500000;
    const risk = r.riskScore ?? 0;

    if (risk >= 61) {
      counts[isHighValue ? "High Value / High Risk" : "High Risk"]++;
    } else if (risk >= 41) {
      counts["Moderate Risk"]++;
    } else {
      counts[isHighValue ? "Low Risk / High Value" : "Low Risk / Low Value"]++;
    }
  }

  return Object.entries(counts).map(([segment, count]) => ({ segment: segment as CustomerSegment["segment"], count }));
}

export function geographicRisk(rows: DashboardRow[]): { location: string; averageRiskScore: number; averagePremium: number; count: number }[] {
  const map = new Map<string, { riskSum: number; premiumSum: number; riskCount: number; premiumCount: number; count: number }>();
  for (const r of rows) {
    const entry = map.get(r.location) ?? { riskSum: 0, premiumSum: 0, riskCount: 0, premiumCount: 0, count: 0 };
    entry.count++;
    if (r.riskScore != null) { entry.riskSum += r.riskScore; entry.riskCount++; }
    if (r.finalPremium != null) { entry.premiumSum += r.finalPremium; entry.premiumCount++; }
    map.set(r.location, entry);
  }
  return Array.from(map.entries())
    .map(([location, v]) => ({
      location,
      averageRiskScore: v.riskCount ? Math.round((v.riskSum / v.riskCount) * 10) / 10 : 0,
      averagePremium: v.premiumCount ? Math.round(v.premiumSum / v.premiumCount) : 0,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function fraudTrends(rows: DashboardRow[]): { anomalyLevel: string; count: number }[] {
  const counts: Record<string, number> = { Low: 0, Moderate: 0, High: 0 };
  for (const r of rows) {
    const level = r.anomalyLevel ? r.anomalyLevel.charAt(0) + r.anomalyLevel.slice(1).toLowerCase() : "Low";
    counts[level] = (counts[level] ?? 0) + 1;
  }
  return Object.entries(counts).map(([anomalyLevel, count]) => ({ anomalyLevel, count }));
}
