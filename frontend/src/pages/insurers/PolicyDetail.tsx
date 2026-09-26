import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ShieldQuestion } from "lucide-react";
import type { RiskFactorContribution, FraudSignal } from "@insurtechai/shared";
import { PageHeader, PageBody } from "../../components/shell/AppShell";
import { RequireAuth } from "../../components/shell/RequireAuth";
import { Panel, PanelHeader, Tag, Skeleton } from "../../components/ui/Primitives";
import { FactorChart } from "../../components/estimate/FactorChart";
import { useT } from "../../context/I18nContext";
import { api } from "../../lib/api";
import { COVER_LABEL, DB_RISK, RISK_TONE, TYPE_LABEL, inr } from "../../lib/utils";

const MARITAL: Record<string, string> = {
  SINGLE: "single",
  MARRIED: "married",
  DIVORCED: "divorced",
  WIDOWED: "widowed",
};

const CLAIM_STATUS: Record<string, string> = {
  SETTLED: "settled",
  UNDER_REVIEW: "under_review",
  REJECTED: "rejected",
};

function DetailInner() {
  const { applicantId } = useParams();
  const t = useT();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (applicantId) api.policyholder(applicantId).then(setD).catch((e) => setError(e.message));
  }, [applicantId]);

  if (error) {
    return (
      <PageBody>
        <p className="text-sm text-fg-muted">{error}</p>
        <Link to="/insurers/policies" className="mt-3 inline-flex items-center gap-1 text-sm text-accent-text hover:underline"><ArrowLeft className="size-3.5" /> {t("Back to policies")}</Link>
      </PageBody>
    );
  }
  if (!d) return <PageBody><Skeleton className="h-8 w-64" /><Skeleton className="mt-6 h-64" /></PageBody>;

  const { applicant, policies, riskAssessments, riskFactors, premiumCalculations, fraudAssessments, claims } = d;
  const policy = policies[0];
  const ra = riskAssessments[0];
  const pc = premiumCalculations.find((p: any) => p.riskAssessmentId === ra?.id);
  const fa = fraudAssessments.find((f: any) => f.riskAssessmentId === ra?.id);
  const cat = ra ? DB_RISK[ra.riskCategory] : null;
  const factors: RiskFactorContribution[] = riskFactors.filter((f: any) => f.riskAssessmentId === ra?.id);
  const signals: FraudSignal[] = fa ? JSON.parse(fa.signalsJson) : [];
  const claimTotal = claims.reduce((s: number, c: any) => s + c.claimAmount, 0);

  return (
    <>
      <PageHeader
        meta={
          <>
            <Link to="/insurers/policies" className="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg"><ArrowLeft className="size-3" /> {t("Policies")}</Link>
            <span className="text-fg-subtle">/</span>
            <span className="font-mono text-xs text-fg-muted">{policy?.policyNumber}</span>
          </>
        }
        title={`${applicant.occupation}, ${applicant.age}`}
        description={[
          applicant.location,
          MARITAL[applicant.maritalStatus] ? t(MARITAL[applicant.maritalStatus]) : applicant.maritalStatus.toLowerCase(),
          applicant.dependents === 1 ? t("{n} dependent", { n: applicant.dependents }) : t("{n} dependents", { n: applicant.dependents }),
          t("income {amount}", { amount: inr(applicant.annualIncome) }),
        ].join(" · ")}
        actions={cat && <Tag tone={RISK_TONE[cat]} dot>{t(cat)} · {ra.riskScore}</Tag>}
      />
      <PageBody className="space-y-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          {[
            [t("Cover"), policy ? `${t(TYPE_LABEL[policy.insuranceType as keyof typeof TYPE_LABEL])} · ${COVER_LABEL[policy.coverageLevel as keyof typeof COVER_LABEL] ? t(COVER_LABEL[policy.coverageLevel as keyof typeof COVER_LABEL]) : policy.coverageLevel}` : "–"],
            [t("Premium"), pc ? inr(pc.finalPremium) : "–"],
            [t("Claims"), `${claims.length} · ${inr(claimTotal)}`],
            [t("Consistency score"), fa ? `${fa.fraudScore} / 100` : "–"],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface px-4 py-3.5">
              <p className="text-2xs text-fg-subtle">{k}</p>
              <p className="num mt-1 text-md font-medium text-fg">{v}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel>
            <PanelHeader title={t("Risk factors")} description={t("From the latest assessment")} />
            <FactorChart factors={factors} />
          </Panel>
          <div className="space-y-4">
            <Panel>
              <PanelHeader title={t("Flags for review")} actions={signals.length ? <Tag tone="warning" dot>{signals.length}</Tag> : <Tag tone="positive" dot>{t("None")}</Tag>} />
              <div className="p-4">
                {signals.length === 0 ? (
                  <p className="text-sm text-fg-muted">{t("No inconsistencies in this application.")}</p>
                ) : (
                  <ul className="space-y-2.5">
                    {signals.map((s) => (
                      <li key={s.code} className="flex gap-2.5 text-sm">
                        <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-warning" />
                        <span className="text-fg-muted">{s.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-2xs text-fg-subtle">{t("Flags point to answers worth verifying. They aren't evidence of wrongdoing.")}</p>
              </div>
            </Panel>
            <Panel>
              <PanelHeader title={t("Claims history")} />
              {claims.length === 0 ? (
                <p className="p-4 text-sm text-fg-muted">{t("No claims.")}</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {claims.map((c: any) => (
                      <tr key={c.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2 font-mono text-xs text-fg-subtle">{c.claimDate?.slice(0, 10)}</td>
                        <td className="px-4 py-2 text-fg-muted">{c.claimType}</td>
                        <td className="num px-4 py-2 text-right">{inr(c.claimAmount)}</td>
                        <td className="px-4 py-2 text-right"><Tag>{CLAIM_STATUS[c.status] ? t(CLAIM_STATUS[c.status]) : c.status.toLowerCase()}</Tag></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}

export function InsurerPolicyDetail() {
  const t = useT();
  return (
    <RequireAuth title={t("Insurer workspace")} reason={t("The workspace shows portfolio analytics on a synthetic sample book. Sign in to open it.")}>
      <DetailInner />
    </RequireAuth>
  );
}
