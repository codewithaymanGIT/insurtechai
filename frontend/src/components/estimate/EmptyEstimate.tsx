import { Gauge } from "lucide-react";
import { ButtonLink } from "../ui/Button";
import { Kbd } from "../ui/Primitives";
import { useT } from "../../context/I18nContext";

export function EmptyEstimate({ what }: { what: string }) {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface">
        <Gauge className="size-4 text-fg-muted" />
      </div>
      <h1 className="mt-4 text-lg font-medium">{t("No estimate yet")}</h1>
      <p className="mt-1.5 text-sm text-fg-muted">{what}</p>
      <ButtonLink to="/estimate/new" variant="primary" size="lg" className="mt-6">
        {t("Get an estimate")}
      </ButtonLink>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-subtle">
        {t("or press")} <Kbd>N</Kbd>
      </p>
    </div>
  );
}
