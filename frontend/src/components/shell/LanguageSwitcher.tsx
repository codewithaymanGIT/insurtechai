import { Check, Languages } from "lucide-react";
import { LANGUAGES } from "@insurtechai/shared";
import { DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel } from "../ui/Overlays";
import { useI18n } from "../../context/I18nContext";
import { Spinner } from "../ui/Spinner";
import { cn } from "../../lib/utils";

export function LanguageSwitcher({ className, align = "end", side = "bottom", full }: { className?: string; align?: "start" | "end"; side?: "top" | "bottom"; full?: boolean }) {
  const { lang, setLang, t, loading } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang)!;
  return (
    <DropdownMenu>
      <DropdownTrigger
        aria-label={t("Language")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus:outline-none data-[state=open]:bg-surface-2",
          full && "w-full",
          className,
        )}
      >
        {loading ? <Spinner className="size-4" /> : <Languages className="size-4" />}
        <span className={cn(full ? "flex-1 text-left" : "max-sm:hidden")}>{current.native}</span>
      </DropdownTrigger>
      <DropdownContent align={align} side={side} className="w-[200px]">
        <DropdownLabel>{t("Language")}</DropdownLabel>
        {LANGUAGES.map((l) => (
          <DropdownItem
            key={l.code}
            onSelect={() => setLang(l.code)}
            shortcut={l.code === lang ? <Check className="size-3.5 text-accent-text" /> : <span className="text-2xs text-fg-subtle">{l.name}</span>}
          >
            <span lang={l.code}>{l.native}</span>
          </DropdownItem>
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}
