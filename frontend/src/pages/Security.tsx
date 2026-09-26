import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ShieldOff, Smartphone, Monitor, Copy, Download, Check, LogOut, KeyRound } from "lucide-react";
import { PageHeader, PageBody } from "../components/shell/AppShell";
import { RequireAuth } from "../components/shell/RequireAuth";
import { Panel, PanelHeader, Tag, Skeleton, Callout } from "../components/ui/Primitives";
import { Button } from "../components/ui/Button";
import { Input, Field } from "../components/ui/Input";
import { Dialog } from "../components/ui/Overlays";
import { useAuth } from "../context/AuthContext";
import { useAssessment } from "../context/AssessmentContext";
import { useT } from "../context/I18nContext";
import { api, ApiError, type DeviceSession } from "../lib/api";
import { relativeDate } from "../lib/utils";

/** Rough "Chrome on Windows" label from a user-agent string. */
function describeDevice(ua: string | null, t: (s: string, v?: Record<string, string>) => string): { label: string; mobile: boolean } {
  if (!ua) return { label: t("Unknown device"), mobile: false };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  const mobile = /Android|iPhone|iPad|Mobile/.test(ua);
  if (browser && os) return { label: t("{browser} on {os}", { browser, os }), mobile };
  return { label: browser ?? os ?? ua.slice(0, 40), mobile };
}

function CodesList({ codes }: { codes: string[] }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border border-border bg-bg-subtle p-4 font-mono text-sm">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked; user can select the text */
            }
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? t("Copied") : t("Copy")}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([`${t("InsurTechAI recovery codes")}\n\n${text}\n\n${t("Each code works once.")}\n`], { type: "text/plain" }));
            const a = Object.assign(document.createElement("a"), { href: url, download: "insurtechai-recovery-codes.txt" });
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download /> {t("Download")}
        </Button>
      </div>
    </div>
  );
}

function TwoFactor({ enabled, codesLeft, onChange }: { enabled: boolean; codesLeft: number; onChange: () => void }) {
  const t = useT();
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<null | "disable" | "regen">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  return (
    <Panel>
      <PanelHeader
        title={t("Two-step verification")}
        description={t("After your email code or Google, also ask for a code from an authenticator app such as Google Authenticator, Microsoft Authenticator or Authy.")}
        actions={enabled ? <Tag tone="positive" dot>{t("On")}</Tag> : <Tag dot>{t("Off")}</Tag>}
      />
      <div className="space-y-4 p-4">
        {codes && (
          <Callout tone="accent" icon={<KeyRound />}>
            <p className="font-medium text-fg">{t("Save your recovery codes")}</p>
            <p className="mb-3 mt-1 text-fg-muted">{t("If you lose your phone, each of these codes lets you sign in once. They won't be shown again.")}</p>
            <CodesList codes={codes} />
            <Button size="sm" variant="primary" className="mt-4" onClick={() => setCodes(null)}>{t("I've saved them")}</Button>
          </Callout>
        )}

        {!enabled && !setup && !codes && (
          <Button variant="primary" loading={busy} onClick={() => run(async () => setSetup(await api.startMfaSetup()))}>
            <ShieldCheck /> {t("Turn on two-step verification")}
          </Button>
        )}

        {!enabled && setup && (
          <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
            <img src={setup.qr} alt={t("QR code for your authenticator app")} className="size-[180px] rounded-lg bg-white p-2" />
            <div className="space-y-4">
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-fg-muted">
                <li>{t("Open your authenticator app and add an account.")}</li>
                <li>{t("Scan the QR code, or type this key:")} <code className="break-all rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code></li>
                <li>{t("Enter the 6-digit code the app shows.")}</li>
              </ol>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const r = await api.enableMfa(code);
                    setCodes(r.recoveryCodes);
                    setSetup(null);
                    setCode("");
                    onChange();
                  });
                }}
              >
                <Input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label={t("Code from your app")} value={code} onChange={(e) => setCode(digits(e.target.value))} className="w-36 font-mono" />
                <Button type="submit" variant="primary" loading={busy} disabled={code.length !== 6}>{t("Turn on")}</Button>
                <Button onClick={() => { setSetup(null); setCode(""); }} variant="ghost">{t("Cancel")}</Button>
              </form>
            </div>
          </div>
        )}

        {enabled && !codes && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-fg-muted">{t("{n} recovery codes left.", { n: codesLeft })}</p>
            <Button size="sm" onClick={() => { setMode("regen"); setCode(""); setError(null); }}><KeyRound /> {t("New recovery codes")}</Button>
            <Button size="sm" variant="danger" onClick={() => { setMode("disable"); setCode(""); setError(null); }}><ShieldOff /> {t("Turn off")}</Button>
          </div>
        )}

        {error && !mode && <p className="text-sm text-danger">{error}</p>}
      </div>

      <Dialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        title={mode === "disable" ? t("Turn off two-step verification?") : t("Replace your recovery codes?")}
        description={mode === "disable" ? t("Your account will be protected by your email code or Google sign-in only. Enter a code from your authenticator app to confirm.") : t("Your old codes will stop working. Enter a code from your authenticator app to confirm.")}
      >
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (mode === "disable") await api.disableMfa({ code });
              else setCodes((await api.newRecoveryCodes(code)).recoveryCodes);
              setMode(null);
              setCode("");
              onChange();
            });
          }}
        >
          <Field label={t("Code from your app")} error={error ?? undefined}>
            {(id) => <Input id={id} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(digits(e.target.value))} className="font-mono" autoFocus />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setMode(null)}>{t("Cancel")}</Button>
            <Button type="submit" variant={mode === "disable" ? "danger" : "primary"} loading={busy} disabled={code.length !== 6}>
              {mode === "disable" ? t("Turn off") : t("Replace codes")}
            </Button>
          </div>
        </form>
      </Dialog>
    </Panel>
  );
}

function Devices({ sessions, onChange }: { sessions: DeviceSession[]; onChange: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.current).length;
  return (
    <Panel>
      <PanelHeader
        title={t("Signed-in devices")}
        description={t("Sign out anything you don't recognise.")}
        actions={others > 0 && (
          <Button size="sm" loading={busy === "all"} onClick={async () => { setBusy("all"); await api.revokeOtherSessions().catch(() => {}); setBusy(null); onChange(); }}>
            <LogOut /> {t("Sign out all others")}
          </Button>
        )}
      />
      <ul className="divide-y divide-border/60">
        {sessions.map((s) => {
          const d = describeDevice(s.userAgent, t);
          const Icon = d.mobile ? Smartphone : Monitor;
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-4 shrink-0 text-fg-subtle" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">
                  {d.label} {s.current && <Tag tone="accent" className="ml-1.5">{t("This device")}</Tag>}
                </p>
                <p className="text-2xs text-fg-subtle">
                  {t("Active {when}", { when: relativeDate(s.lastSeenAt, t) })}{s.ip ? ` · ${s.ip}` : ""}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="ghost" loading={busy === s.id} onClick={async () => { setBusy(s.id); await api.revokeSession(s.id).catch(() => {}); setBusy(null); onChange(); }}>
                  {t("Sign out")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function SecurityInner() {
  const t = useT();
  const { user, refresh, signOut } = useAuth();
  const { clear } = useAssessment();
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.security>> | null>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [savedName, setSavedName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    api.security().then(setData).catch(() => setData(null));
    refresh();
  }, [refresh]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title={t("Account and security")} description={t("Signed in as {email}", { email: user?.email ?? "" })} />
      <PageBody className="max-w-3xl space-y-4">
        <Panel>
          <PanelHeader title={t("Profile")} />
          <form
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              await api.saveProfile(name.trim()).catch(() => {});
              await refresh();
              setSavedName(true);
              setTimeout(() => setSavedName(false), 1500);
            }}
          >
            <Field label={t("Your name")} className="flex-1">
              {(id) => <Input id={id} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Button type="submit" disabled={!name.trim() || name.trim() === user?.name}>{savedName ? <><Check /> {t("Saved")}</> : t("Save")}</Button>
          </form>
        </Panel>

        {!data ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-40" />
          </>
        ) : (
          <>
            <TwoFactor enabled={data.mfaEnabled} codesLeft={data.recoveryCodesLeft} onChange={load} />
            <Devices sessions={data.sessions} onChange={load} />
          </>
        )}

        <Panel className="border-danger/25">
          <PanelHeader
            title={t("Delete account")}
            description={t("Permanently deletes your account and every saved estimate. This can't be undone.")}
            actions={<Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>{t("Delete account")}</Button>}
          />
        </Panel>

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} title={t("Delete your account?")} description={t("This removes {email}, your saved estimates, recovery codes and sign-in sessions.", { email: user?.email ?? "" })}>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setConfirmDelete(false)}>{t("Cancel")}</Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await api.deleteAccount();
                  clear();
                  await signOut();
                  navigate("/", { replace: true });
                } catch {
                  setDeleting(false);
                }
              }}
            >
              {t("Delete permanently")}
            </Button>
          </div>
        </Dialog>
      </PageBody>
    </>
  );
}

export function Security() {
  const t = useT();
  return (
    <RequireAuth title={t("Account and security")} reason={t("Sign in to manage your account.")}>
      <SecurityInner />
    </RequireAuth>
  );
}
