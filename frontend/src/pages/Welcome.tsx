import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LogoMark } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";
import { Input, Field } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "../context/AuthContext";
import { useT } from "../context/I18nContext";
import { api, ApiError } from "../lib/api";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/estimate/new";
  return raw;
}

/** Second half of signup: shown once, right after a new account's first sign-in. */
export function Welcome() {
  const { user, ready, refresh } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate(`/signin?next=${encodeURIComponent(next)}`, { replace: true });
    else if (!user.needsProfile) navigate(next, { replace: true });
    else if (!name) setName(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t("Enter your name."));
    if (!agree) return setError(t("Please agree to the terms to continue."));
    setBusy(true);
    setError(null);
    try {
      await api.saveProfile(name.trim(), true);
      await refresh();
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !user) {
    return <div className="flex min-h-screen items-center justify-center text-fg-subtle"><Spinner /></div>;
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-[14vh]">
      <form onSubmit={submit} className="w-full max-w-[380px]" noValidate>
        <LogoMark className="size-9" />
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.025em]">{t("Finish creating your account")}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t("Signed in as {email}. One more step.", { email: user.email })}</p>

        <div className="mt-8 space-y-5">
          <Field label={t("Your name")}>
            {(id) => <Input id={id} inputSize="lg" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />}
          </Field>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-border-strong accent-[hsl(var(--accent))]"
            />
            <span>
              {t("I agree to the")}{" "}
              <Link to="/terms" target="_blank" className="text-fg underline underline-offset-2">{t("Terms")}</Link>{" "}
              {t("and")}{" "}
              <Link to="/methodology#privacy" target="_blank" className="text-fg underline underline-offset-2">{t("Privacy notice")}</Link>
              {t(", and understand that estimates are not insurance quotes.")}
            </span>
          </label>
        </div>

        {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}

        <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={busy}>
          {t("Create account")}
        </Button>
      </form>
    </div>
  );
}
