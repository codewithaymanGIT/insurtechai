import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MarketingLayout } from "../components/shell/Marketing";
import { Eyebrow } from "../components/ui/Primitives";
import { useT } from "../context/I18nContext";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-md leading-7 text-fg-muted">{children}</div>
    </section>
  );
}

export function Terms() {
  const t = useT();
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-14 sm:px-6">
        <Eyebrow>{t("Terms")}</Eyebrow>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] max-sm:text-3xl">{t("Terms of use")}</h1>
        <p className="mt-4 text-md text-fg-muted">{t("Plain-language terms for using InsurTechAI. By creating an account you agree to them.")}</p>

        <div className="mt-10 space-y-8">
          <Section title={t("What the service is")}>
            <p>{t("InsurTechAI gives estimates of insurance premiums in India and explains how they are worked out. It is not an insurer, broker, corporate agent or web aggregator registered with IRDAI, and it does not sell or arrange insurance.")}</p>
          </Section>
          <Section title={t("Estimates are not quotes")}>
            <p>{t("Estimates, scores, market comparisons, tax figures and AI answers are for information only. Insurers set their own prices and decide who they cover. Before you buy, check the policy wording and get quotes from insurers or an IRDAI-registered intermediary. Tax figures are general and don't replace advice from a tax professional.")}</p>
          </Section>
          <Section title={t("Your account")}>
            <p>{t("You sign in with a one-time code or Google, and can add an authenticator app for extra security. Keep your email account and recovery codes safe; anyone with access to them can sign in as you. You can delete your account and everything in it at any time from the Security page.")}</p>
          </Section>
          <Section title={t("Fair use")}>
            <p>{t("Don't try to break, overload or scrape the service, get around its limits, or use it for anything unlawful. The AI assistant has a daily question limit, and accounts that abuse it may be suspended.")}</p>
          </Section>
          <Section title={t("Your data")}>
            <p>
              {t("What we store and why is described in the")}{" "}
              <Link to="/methodology#privacy" className="text-fg underline underline-offset-2">{t("Privacy notice")}</Link>.{" "}
              {t("We don't sell your data or share it with insurers.")}
            </p>
          </Section>
          <Section title={t("Liability")}>
            <p>{t("The service is provided as it is. We work to keep figures accurate and sourced, but we can't guarantee them, and we're not responsible for decisions made using them.")}</p>
          </Section>
        </div>
      </div>
    </MarketingLayout>
  );
}
