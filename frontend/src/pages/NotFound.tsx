import { MarketingLayout } from "../components/shell/Marketing";
import { ButtonLink } from "../components/ui/Button";
import { useT } from "../context/I18nContext";

export function NotFound() {
  const t = useT();
  return (
    <MarketingLayout>
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <p className="font-mono text-sm text-fg-subtle">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">{t("There's nothing at this address")}</h1>
        <p className="mt-2 text-sm text-fg-muted">{t("The link may be old, or the page may have moved.")}</p>
        <div className="mt-6 flex gap-2">
          <ButtonLink to="/" variant="secondary">{t("Home")}</ButtonLink>
          <ButtonLink to="/estimate/new" variant="primary">{t("Get an estimate")}</ButtonLink>
        </div>
      </div>
    </MarketingLayout>
  );
}
