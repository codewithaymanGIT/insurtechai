import type { Recommendation } from "@insurtechai/shared";
import { Tag } from "../ui/Primitives";
import { inr } from "../../lib/utils";
import { useT } from "../../context/I18nContext";

const EFFORT_TONE = { Low: "positive", Medium: "neutral", High: "warning" } as const;

export function SavingsTable({ items, limit = 6 }: { items: Recommendation[]; limit?: number }) {
  const t = useT();
  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-fg-muted">{t("None of the changes this tool models would lower your premium noticeably.")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-2xs font-medium text-fg-subtle">
            <th className="px-4 py-2 font-medium">{t("Change")}</th>
            <th className="px-4 py-2 font-medium">{t("Effort")}</th>
            <th className="px-4 py-2 text-right font-medium">{t("Saves / year")}</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, limit).map((r) => (
            <tr key={r.id} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3 align-top">
                <p className="text-fg">{r.title}</p>
                <p className="mt-0.5 max-w-md text-xs text-fg-subtle">{r.description}</p>
              </td>
              <td className="px-4 py-3 align-top">
                <Tag tone={EFFORT_TONE[r.effort]}>{t(r.effort)}</Tag>
              </td>
              <td className="px-4 py-3 text-right align-top">
                <p className="num font-medium text-positive">{inr(r.estimatedSavingAmount)}</p>
                <p className="num text-2xs text-fg-subtle">{r.estimatedSavingPercent}%</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
