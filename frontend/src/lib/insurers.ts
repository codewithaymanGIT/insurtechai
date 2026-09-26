// Published claim records for the insurers most people in India are quoted by.
// Figures are for FY 2024-25 as reported by the sources below, which compile
// them from IRDAI's Handbook and the insurers' public disclosures (form NL-37
// for general and health insurers). Update once a year when IRDAI publishes
// the next annual report.

export interface Source {
  label: string;
  url: string;
}

export interface LifeInsurer {
  name: string;
  /** Individual death claims paid, by number, % */
  csr: number;
}

export interface HealthInsurer {
  name: string;
  kind: "Standalone health" | "Private general" | "Public sector";
  /** Claims settled by number, % */
  csr: number;
  /** Claims incurred ÷ premium earned, % */
  icr: number;
  caution?: string;
}

export const LIFE: LifeInsurer[] = [
  { name: "Bandhan Life", csr: 99.73 },
  { name: "Axis Max Life", csr: 99.7 },
  { name: "HDFC Life", csr: 99.68 },
  { name: "PNB MetLife", csr: 99.57 },
  { name: "Canara HSBC Life", csr: 99.43 },
  { name: "Tata AIA", csr: 99.41 },
  { name: "ICICI Prudential", csr: 99.31 },
  { name: "Bajaj Life", csr: 99.29 },
  { name: "Edelweiss Life", csr: 99.29 },
  { name: "Bharti AXA Life", csr: 99.18 },
  { name: "Aditya Birla Sun Life", csr: 98.65 },
  { name: "Kotak Life", csr: 98.61 },
  { name: "SBI Life", csr: 98.34 },
  { name: "LIC", csr: 97.59 },
];

export const LIFE_INDUSTRY = { byNumber: 98.32, byAmount: 97.18 };

export const HEALTH: HealthInsurer[] = [
  { name: "HDFC ERGO", kind: "Private general", csr: 97.5, icr: 84.85 },
  { name: "Care Health", kind: "Standalone health", csr: 96.7, icr: 64.53 },
  { name: "New India Assurance", kind: "Public sector", csr: 98.4, icr: 100.98 },
  { name: "Aditya Birla Health", kind: "Standalone health", csr: 95.3, icr: 71.5 },
  { name: "Bajaj General", kind: "Private general", csr: 94, icr: 87.31 },
  { name: "ManipalCigna", kind: "Standalone health", csr: 93.7, icr: 74.81 },
  { name: "Niva Bupa", kind: "Standalone health", csr: 92.4, icr: 61.22 },
  { name: "Star Health", kind: "Standalone health", csr: 88.3, icr: 70.3 },
  { name: "ICICI Lombard", kind: "Private general", csr: 83.7, icr: 82.24 },
  { name: "Tata AIG", kind: "Private general", csr: 100, icr: 76.24, caution: "Reported as exactly 100% by the source. We couldn't match it to the insurer's own disclosure, so treat it with care." },
];

/** IRDAI Annual Report 2024-25: health incurred claim ratio by insurer group. */
export const HEALTH_INDUSTRY_ICR = { industry: 85.34, publicSector: 99.84, private: 83.46, standalone: 68.06 };

export const SOURCES: Record<"irdai" | "life" | "lifeIndustry" | "healthCsr" | "healthIcr", Source> = {
  irdai: { label: "IRDAI Annual Report 2024-25", url: "https://irdai.gov.in/document-detail?documentId=8375620" },
  life: { label: "ArthaEngine, citing IRDAI Handbook (FY 2024-25)", url: "https://arthaengine.com/insurers/claim-settlement-ratio-2026" },
  lifeIndustry: { label: "Insurance Business, on the FY 2024-25 industry ratio", url: "https://www.insurancebusinessmag.com/asia/news/life-insurance/what-indias-claims-settlement-ratio-doesnt-tell-brokers-586054.aspx" },
  healthCsr: { label: "Policybazaar, from insurers' NL-37 disclosures", url: "https://www.policybazaar.com/health-insurance/claim-settlement-ratio/" },
  healthIcr: { label: "Business Standard, 1 January 2026, citing IRDAI", url: "https://www.business-standard.com/finance/personal-finance/paying-claims-or-pushing-back-what-irdai-data-reveals-about-insurers-126010100580_1.html" },
};
