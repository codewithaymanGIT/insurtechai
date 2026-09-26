import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, ArrowUpRight, FilePlus2 } from "lucide-react";
import { PageHeader, PageBody } from "../components/shell/AppShell";
import { RequireAuth } from "../components/shell/RequireAuth";
import { Panel, Tag, Skeleton } from "../components/ui/Primitives";
import { Button, ButtonLink } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useT } from "../context/I18nContext";
import { useAssessment } from "../context/AssessmentContext";
import { api, type SavedEstimateRow } from "../lib/api";
import { TYPE_LABEL, inr, relativeDate, riskFromScore, RISK_TONE } from "../lib/utils";

function AccountInner() {
  const { user } = useAuth();
  const { setAssessment } = useAssessment();
  const t = useT();
  const navigate = useNavigate();
  const [rows, setRows] = useState<SavedEstimateRow[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.savedEstimates().then((r) => setRows(r.assessments)).catch(() => setError(t("Couldn't load your estimates.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(id: string) {
    setOpening(id);
    try {
      const r = await api.savedEstimate(id);
      // Re-run the saved answers (without saving a copy) so the result uses the
      // current rates and the language the visitor is reading in now.
      const fresh = await api.estimate(r.applicant, { save: false });
      setAssessment(r.applicant, { ...fresh, savedId: r.id });
      navigate("/estimate");
    } catch {
      setError(t("Couldn't open that estimate."));
    } finally {
      setOpening(null);
    }
  }

  async function remove(id: string) {
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? null);
    await api.deleteSavedEstimate(id).catch(() => setError(t("Couldn't delete that estimate. Refresh and try again.")));
  }

  return (
    <>
      <PageHeader title={t("Saved estimates")} description={t("Signed in as {email}", { email: user?.email ?? "" })} actions={<ButtonLink to="/estimate/new" variant="primary"><FilePlus2 /> {t("New estimate")}</ButtonLink>} />
      <PageBody className="max-w-4xl space-y-6">
        {error && <p className="text-sm text-danger">{error}</p>}

        <Panel>
          {rows === null ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-fg">{t("No saved estimates yet")}</p>
              <p className="mt-1 text-xs text-fg-subtle">{t("Estimates you make while signed in are saved here automatically.")}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-2xs text-fg-subtle">
                  <th className="px-4 py-2 font-medium">{t("Cover")}</th>
                  <th className="px-4 py-2 font-medium">{t("Risk")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Premium")}</th>
                  <th className="px-4 py-2 font-medium max-sm:hidden">{t("Saved")}</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cat = riskFromScore(r.riskScore);
                  return (
                    <tr key={r.id} className="group border-b border-border/60 last:border-0 hover:bg-surface-2/50">
                      <td className="px-4 py-2.5">
                        <button onClick={() => open(r.id)} className="flex items-center gap-1.5 text-fg hover:underline" disabled={opening === r.id}>
                          {t(TYPE_LABEL[r.insuranceType])} <ArrowUpRight className="size-3.5 text-fg-subtle" />
                        </button>
                      </td>
                      <td className="px-4 py-2.5"><Tag tone={RISK_TONE[cat]} dot>{r.riskScore}</Tag></td>
                      <td className="num px-4 py-2.5 text-right">{inr(r.finalPremium)}</td>
                      <td className="px-4 py-2.5 text-fg-subtle max-sm:hidden">{relativeDate(r.createdAt, t)}</td>
                      <td className="px-2 py-2.5 text-right">
                        <Button variant="ghost" size="icon-sm" aria-label={t("Delete estimate")} onClick={() => remove(r.id)} className="opacity-60 group-hover:opacity-100">
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

      </PageBody>
    </>
  );
}

export function Account() {
  const t = useT();
  return (
    <RequireAuth title={t("Your saved estimates")} reason={t("Sign in to see estimates you've saved.")}>
      <AccountInner />
    </RequireAuth>
  );
}
