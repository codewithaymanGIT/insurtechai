import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "../../components/shell/AppShell";
import { RequireAuth } from "../../components/shell/RequireAuth";
import { Panel, PanelHeader, Skeleton } from "../../components/ui/Primitives";
import { RankedBars } from "../../components/insurer/Charts";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../context/I18nContext";
import { api, type UsageStats } from "../../lib/api";
import { TYPE_LABEL, num } from "../../lib/utils";

function UsageInner() {
  const { user } = useAuth();
  const t = useT();
  const [u, setU] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === "ADMIN") api.usage().then(setU).catch((e) => setError(e.message));
  }, [user]);

  if (user?.role !== "ADMIN") {
    return <PageBody><p className="text-sm text-fg-muted">{t("Only admins can see site usage. Admins are set with ADMIN_EMAILS in the backend's .env.")}</p></PageBody>;
  }

  const stats: [string, number | undefined][] = [
    [t("Accounts"), u?.users],
    [t("New this week"), u?.newUsersWeek],
    [t("Signed-in sessions"), u?.activeSessions],
    [t("Saved estimates"), u?.savedEstimates],
    [t("AI questions, 24 h"), u?.chats24h],
    [t("AI questions, 7 days"), u?.chats7d],
  ];

  return (
    <>
      <PageHeader title={t("Site usage")} description={t("Counts from the live site. No personal details are shown here.")} />
      <PageBody className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(([label, v]) => (
            <div key={label} className="bg-surface px-4 py-3.5">
              <p className="text-2xs text-fg-subtle">{label}</p>
              {v === undefined ? <Skeleton className="mt-2 h-6 w-12" /> : <p className="num mt-1 text-xl font-semibold">{num(v)}</p>}
            </div>
          ))}
        </div>
        <Panel className="max-w-xl">
          <PanelHeader title={t("Saved estimates by cover")} />
          <div className="p-4">
            {!u ? <Skeleton className="h-24" /> : u.estimatesByType.length === 0 ? (
              <p className="text-sm text-fg-muted">{t("No saved estimates yet.")}</p>
            ) : (
              <RankedBars rows={u.estimatesByType.map((e) => ({ label: TYPE_LABEL[e.insuranceType] ? t(TYPE_LABEL[e.insuranceType]) : e.insuranceType, value: e.n }))} />
            )}
          </div>
        </Panel>
      </PageBody>
    </>
  );
}

export function InsurerUsage() {
  const t = useT();
  return (
    <RequireAuth title={t("Site usage")} reason={t("Sign in with an admin account to see usage.")}>
      <UsageInner />
    </RequireAuth>
  );
}
