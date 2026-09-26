import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { LOCATIONS } from "@insurtechai/shared";
import { PageHeader, PageBody } from "../../components/shell/AppShell";
import { RequireAuth } from "../../components/shell/RequireAuth";
import { Panel, Tag, Skeleton } from "../../components/ui/Primitives";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Segmented } from "../../components/ui/Controls";
import { useT } from "../../context/I18nContext";
import { api, type PortfolioRow } from "../../lib/api";
import { DB_RISK, RISK_TONE, TYPE_LABEL, inr, num } from "../../lib/utils";

const PAGE = 25;

function PoliciesInner() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const t = useT();
  const type = params.get("type") ?? "";
  const risk = params.get("risk") ?? "";
  const city = params.get("city") ?? "";
  const page = Math.max(0, Number(params.get("page") ?? 0));

  const [rows, setRows] = useState<PortfolioRow[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setRows(null);
    api
      .portfolio({ insuranceType: type || undefined, riskCategory: risk || undefined, location: city || undefined, limit: PAGE, offset: page * PAGE })
      .then((r) => {
        setRows(r.applicants);
        setTotal(r.total);
      })
      .catch(() => setRows([]));
  }, [type, risk, city, page]);

  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete("page");
    setParams(next, { replace: true });
  };
  const goPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next, { replace: true });
  };

  const from = total === 0 ? 0 : page * PAGE + 1;
  const to = Math.min(total, (page + 1) * PAGE);

  return (
    <>
      <PageHeader meta={<Tag tone="warning" dot>{t("Synthetic sample data")}</Tag>} title={t("Policies")} description={t("Sorted by risk score, highest first. Open a policy for its factors, claims and flags.")} />
      <PageBody className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Segmented
            aria-label={t("Insurance type")}
            value={type}
            onChange={(v) => setFilter("type", v)}
            options={[{ value: "", label: t("All") }, { value: "HEALTH", label: t(TYPE_LABEL.HEALTH) }, { value: "MOTOR", label: t(TYPE_LABEL.MOTOR) }, { value: "PROPERTY", label: t(TYPE_LABEL.PROPERTY) }, { value: "LIFE", label: t(TYPE_LABEL.LIFE) }]}
          />
          <div className="flex gap-2 sm:ml-auto">
            <Select
              size="sm"
              aria-label={t("Risk band")}
              className="w-36"
              value={risk || "ANY"}
              onChange={(v) => setFilter("risk", v === "ANY" ? "" : v)}
              options={[{ value: "ANY", label: t("Any risk") }, ...Object.entries(DB_RISK).map(([value, label]) => ({ value, label: t(label) }))]}
            />
            <Select
              size="sm"
              aria-label={t("City")}
              className="w-36"
              value={city || "ANY"}
              onChange={(v) => setFilter("city", v === "ANY" ? "" : v)}
              options={[{ value: "ANY", label: t("Any city") }, ...LOCATIONS.map((l) => ({ value: l, label: l }))]}
            />
          </div>
        </div>

        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-2xs text-fg-subtle">
                <th className="px-4 py-2 font-medium">{t("Policy")}</th>
                <th className="px-4 py-2 font-medium">{t("Type")}</th>
                <th className="px-4 py-2 font-medium">{t("Policyholder")}</th>
                <th className="px-4 py-2 font-medium">{t("City")}</th>
                <th className="px-4 py-2 font-medium">{t("Risk")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("Premium")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("Flags")}</th>
              </tr>
            </thead>
            <tbody>
              {rows === null
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/60"><td colSpan={7} className="px-4 py-2.5"><Skeleton className="h-5" /></td></tr>
                  ))
                : rows.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-fg-muted">{t("No policies match these filters.")}</td></tr>
                  : rows.map((r) => {
                      const cat = r.riskCategory ? DB_RISK[r.riskCategory] : null;
                      return (
                        <tr
                          key={r.policyId}
                          tabIndex={0}
                          onClick={() => navigate(`/insurers/policies/${r.applicantId}`)}
                          onKeyDown={(e) => e.key === "Enter" && navigate(`/insurers/policies/${r.applicantId}`)}
                          className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2/60 focus:bg-surface-2/60 focus:outline-none"
                        >
                          <td className="px-4 py-2.5 font-mono text-xs text-fg">{r.policyNumber}</td>
                          <td className="px-4 py-2.5 text-fg-muted">{t(TYPE_LABEL[r.insuranceType])}</td>
                          <td className="px-4 py-2.5 text-fg-muted">
                            <span className="text-fg">{r.age}</span> · {r.occupation}
                          </td>
                          <td className="px-4 py-2.5 text-fg-muted">{r.location}</td>
                          <td className="px-4 py-2.5">{cat ? <Tag tone={RISK_TONE[cat]} dot>{r.riskScore}</Tag> : "–"}</td>
                          <td className="num px-4 py-2.5 text-right">{r.finalPremium ? inr(r.finalPremium) : "–"}</td>
                          <td className="px-4 py-2.5 text-right">
                            {r.fraudScore != null && r.fraudScore > 30 ? <ShieldAlert className={`ml-auto size-4 ${r.fraudScore > 60 ? "text-danger" : "text-warning"}`} aria-label={r.fraudScore > 60 ? t("High consistency flag") : t("Moderate consistency flag")} /> : <span className="text-fg-subtle">–</span>}
                          </td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
        </Panel>

        <div className="flex items-center justify-between text-xs text-fg-subtle">
          <span className="num">{total ? t("{from}–{to} of {total}", { from: num(from), to: num(to), total: num(total) }) : ""}</span>
          <div className="flex gap-1">
            <Button size="icon-sm" variant="ghost" aria-label={t("Previous page")} disabled={page === 0} onClick={() => goPage(page - 1)}><ChevronLeft /></Button>
            <Button size="icon-sm" variant="ghost" aria-label={t("Next page")} disabled={to >= total} onClick={() => goPage(page + 1)}><ChevronRight /></Button>
          </div>
        </div>
      </PageBody>
    </>
  );
}

export function InsurerPolicies() {
  const t = useT();
  return (
    <RequireAuth title={t("Insurer workspace")} reason={t("The workspace shows portfolio analytics on a synthetic sample book. Sign in to open it.")}>
      <PoliciesInner />
    </RequireAuth>
  );
}
