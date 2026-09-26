import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { LogoMark } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Callout } from "../components/ui/Primitives";
import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api, ApiError, type SignInStatus } from "../lib/api";
import { useT, useI18n } from "../context/I18nContext";
import { LanguageSwitcher } from "../components/shell/LanguageSwitcher";
import { loadGoogleIdentity } from "../lib/google";
import { gsap, useGSAP, reducedMotion } from "../lib/motion";
import { cn } from "../lib/utils";

/** Only allow same-site relative redirects after sign-in. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/estimate/new";
  return raw;
}

function CodeInput({ value, onChange, onComplete, disabled }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const t = useT();
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  const setAt = (i: number, d: string) => {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).replace(/\s/g, "").slice(0, 6);
    onChange(next);
    if (next.length === 6) onComplete(next);
  };

  return (
    <div className="flex justify-between gap-2" onPaste={(e) => {
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (!text) return;
      e.preventDefault();
      onChange(text);
      refs.current[Math.min(text.length, 5)]?.focus();
      if (text.length === 6) onComplete(text);
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => void (refs.current[i] = el)}
          value={d.trim()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={t("Digit {n}", { n: i + 1 })}
          maxLength={1}
          autoFocus={i === 0}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            if (!ch) return;
            setAt(i, ch);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (d.trim()) onChange(value.slice(0, i) + value.slice(i + 1));
              else if (i > 0) {
                onChange(value.slice(0, i - 1) + value.slice(i));
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === "ArrowLeft") refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight") refs.current[i + 1]?.focus();
          }}
          className="num h-12 w-full min-w-0 rounded-md border border-border-strong bg-surface text-center font-mono text-lg text-fg transition-[border-color,box-shadow] focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
        />
      ))}
    </div>
  );
}

function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (c: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const { t, lang } = useI18n();
  const cb = useRef(onCredential);
  useEffect(() => {
    cb.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleIdentity()
      .then((gis) => {
        if (cancelled || !ref.current) return;
        gis.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential), ux_mode: "popup", use_fedcm_for_button: true });
        ref.current.innerHTML = "";
        gis.renderButton(ref.current, {
          type: "standard",
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          locale: lang,
          width: Math.min(360, ref.current.offsetWidth || 360),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, theme, lang]);

  if (failed) return <p className="text-center text-xs text-fg-subtle">{t("Google sign-in couldn't load. Use your email instead.")}</p>;
  return <div ref={ref} className="flex h-10 w-full justify-center [color-scheme:normal]" />;
}

type Step = "start" | "code" | "mfa";

export function SignIn() {
  const { user, config, ready, refresh } = useAuth();
  const t = useT();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));

  const [step, setStep] = useState<Step>("start");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready && user && step !== "mfa") navigate(user.needsProfile ? `/welcome?next=${encodeURIComponent(next)}` : next, { replace: true });
  }, [ready, user, next, navigate, step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.from("[data-step]", { opacity: 0, y: 8, duration: 0.4, ease: "power2.out" });
    },
    { scope: card, dependencies: [step] },
  );

  async function after(status: SignInStatus) {
    if (status === "mfa") {
      setCode("");
      setStep("mfa");
      return;
    }
    await refresh();
    navigate(status === "profile" ? `/welcome?next=${encodeURIComponent(next)}` : next, { replace: true });
  }

  async function run(fn: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("Enter a valid email address."));
      return;
    }
    return run(async () => {
      const r = await api.requestCode(email.trim());
      setCooldown(r.resendAfterSeconds);
      setCode("");
      setStep("code");
    }, t("Couldn't send the code. Try again."));
  }

  function verify(value = code) {
    if (value.length !== 6) return;
    return run(async () => {
      try {
        await after((await api.verifyCode(email.trim(), value)).status);
      } catch (err) {
        setCode("");
        throw err;
      }
    }, t("Couldn't verify the code."));
  }

  function verifyMfa(value = code) {
    if (!useRecovery && value.length !== 6) return;
    return run(async () => {
      try {
        await after((await api.verifyMfa(useRecovery ? { recoveryCode: recovery.trim() } : { code: value })).status);
      } catch (err) {
        setCode("");
        if (err instanceof ApiError && err.status === 401) setStep("start");
        throw err;
      }
    }, t("Couldn't verify the code."));
  }

  function google(credential: string) {
    return run(async () => after((await api.signInWithGoogle(credential)).status), t("Google sign-in failed."));
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-dots mask-fade-b opacity-60" />
      <header className="relative flex h-14 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> {t("Home")}
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 pt-[10vh]">
        <div ref={card} className="w-full max-w-[360px]">
          <LogoMark className="size-9" />

          {step === "start" && (
            <div data-step>
              <h1 className="mt-6 text-2xl font-semibold tracking-[-0.025em]">{t("Sign in or create an account")}</h1>
              <p className="mt-1.5 text-sm text-fg-muted">{t("Save your estimates and ask the AI assistant about them. There's no password: we email you a one-time code.")}</p>

              <div className="mt-8 space-y-3">
                {!ready ? (
                  <div className="flex justify-center py-4 text-fg-subtle"><Spinner /></div>
                ) : (
                  <>
                    {config?.googleClientId && (
                      <>
                        <GoogleButton clientId={config.googleClientId} onCredential={google} />
                        <div className="flex items-center gap-3 py-1 text-2xs text-fg-subtle">
                          <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
                        </div>
                      </>
                    )}
                    {config?.emailCodes !== false ? (
                      <form onSubmit={requestCode} className="space-y-3" noValidate>
                        <Input
                          type="email"
                          inputSize="lg"
                          autoComplete="email"
                          placeholder="you@example.com"
                          aria-label={t("Email address")}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-invalid={!!error}
                          autoFocus={!config?.googleClientId}
                        />
                        <Button type="submit" variant={config?.googleClientId ? "secondary" : "primary"} size="lg" className="w-full" loading={busy}>
                          <Mail /> {t("Continue with email")}
                        </Button>
                      </form>
                    ) : (
                      !config?.googleClientId && <Callout tone="warning">{t("Sign-in isn't available right now. Please try again later.")}</Callout>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {step === "code" && (
            <div data-step>
              <h1 className="mt-6 text-2xl font-semibold tracking-[-0.025em]">{t("Check your email")}</h1>
              <p className="mt-1.5 text-sm text-fg-muted">{t("We sent a 6-digit code to {email}. It expires in 10 minutes.", { email: email.trim() })}</p>
              {import.meta.env.DEV && config?.emailDelivery === "console" && (
                <p className="mt-3 rounded-md border border-dashed border-border-strong px-3 py-2 text-2xs text-fg-subtle">
                  {t("Local development: SMTP isn't set up, so the code is printed in the backend terminal.")}
                </p>
              )}
              <div className="mt-8">
                <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
              </div>
              <Button variant="primary" size="lg" className="mt-4 w-full" loading={busy} disabled={code.length !== 6} onClick={() => verify()}>
                {t("Continue")}
              </Button>
              <div className="mt-4 flex items-center justify-between text-xs">
                <button onClick={() => { setStep("start"); setError(null); }} className="text-fg-muted hover:text-fg">{t("Use a different email")}</button>
                <button onClick={() => requestCode()} disabled={cooldown > 0 || busy} className={cn("text-fg-muted hover:text-fg", cooldown > 0 && "cursor-default text-fg-subtle hover:text-fg-subtle")}>
                  {cooldown > 0 ? t("Resend in {seconds}s", { seconds: cooldown }) : t("Resend code")}
                </button>
              </div>
            </div>
          )}

          {step === "mfa" && (
            <div data-step>
              <div className="mt-6 flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
                <ShieldCheck className="size-4 text-accent-text" />
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.025em]">{t("Two-step verification")}</h1>
              {!useRecovery ? (
                <>
                  <p className="mt-1.5 text-sm text-fg-muted">{t("Enter the 6-digit code from your authenticator app.")}</p>
                  <div className="mt-8">
                    <CodeInput value={code} onChange={setCode} onComplete={verifyMfa} disabled={busy} />
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-sm text-fg-muted">{t("Enter one of the recovery codes you saved when you turned on two-step verification. Each code works once.")}</p>
                  <Input
                    className="mt-8 font-mono"
                    inputSize="lg"
                    placeholder="xxxx-xxxx-xxxx"
                    aria-label={t("Recovery code")}
                    value={recovery}
                    autoFocus
                    onChange={(e) => setRecovery(e.target.value)}
                  />
                </>
              )}
              <Button
                variant="primary"
                size="lg"
                className="mt-4 w-full"
                loading={busy}
                disabled={useRecovery ? recovery.trim().length < 8 : code.length !== 6}
                onClick={() => verifyMfa()}
              >
                {t("Verify")}
              </Button>
              <button onClick={() => { setUseRecovery((v) => !v); setError(null); }} className="mt-4 text-xs text-fg-muted hover:text-fg">
                {useRecovery ? t("Use your authenticator app instead") : t("Lost your phone? Use a recovery code")}
              </button>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}

          <p className="mt-10 text-2xs leading-relaxed text-fg-subtle">
            {t("By continuing you agree to the")}{" "}
            <Link to="/terms" className="underline underline-offset-2 hover:text-fg">{t("Terms")}</Link>{" "}
            {t("and")}{" "}
            <Link to="/methodology#privacy" className="underline underline-offset-2 hover:text-fg">{t("Privacy notice")}</Link>.{" "}
            {t("Your estimates are private to your account and you can delete them, or the whole account, at any time.")}
          </p>
        </div>
      </main>
    </div>
  );
}
