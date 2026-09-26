import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../context/I18nContext";
import { ButtonLink } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

/** Shows the page to signed-in users; otherwise explains why sign-in is needed. */
export function RequireAuth({ children, title, reason }: { children: ReactNode; title: string; reason: string }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  const t = useT();

  if (!ready) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-fg-subtle">
        <Spinner />
      </div>
    );
  }
  if (user) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface">
        <Lock className="size-4 text-fg-muted" />
      </div>
      <h1 className="mt-4 text-lg font-medium">{title}</h1>
      <p className="mt-1.5 text-sm text-fg-muted">{reason}</p>
      <ButtonLink to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} variant="primary" size="lg" className="mt-6 w-full">
        {t("Sign in to continue")}
      </ButtonLink>
      <p className="mt-3 text-xs text-fg-subtle">{t("Google or a one-time email code. No password.")}</p>
    </div>
  );
}
