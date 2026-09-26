import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "../ui/Logo";
import { ButtonLink } from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { useT } from "../../context/I18nContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

const LINKS = [
  { to: "/#how", label: "How it works" },
  { to: "/compare", label: "Compare insurers" },
  { to: "/methodology", label: "Methodology" },
  { to: "/insurers", label: "For insurers" },
];

export function MarketingHeader() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200",
        scrolled || open ? "border-border bg-bg/80 backdrop-blur-xl backdrop-saturate-150" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-page items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label={t("InsurTechAI home")}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className="rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors hover:text-fg">
              {t(l.label)}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          {user ? (
            <ButtonLink to="/estimate/new" variant="primary" size="md">{t("Open app")}</ButtonLink>
          ) : (
            <>
              <ButtonLink to="/signin" variant="ghost" size="md">{t("Sign in")}</ButtonLink>
              <ButtonLink to="/estimate/new" variant="primary" size="md">{t("Get an estimate")}</ButtonLink>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher />
          <button className="rounded-md p-2 text-fg-muted hover:bg-surface-2" onClick={() => setOpen((o) => !o)} aria-label={open ? t("Close menu") : t("Open menu")} aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-2 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2.5 text-md text-fg-muted hover:text-fg">
              {t(l.label)}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {user ? (
              <ButtonLink to="/estimate/new" variant="primary" size="lg" className="col-span-2">{t("Open app")}</ButtonLink>
            ) : (
              <>
                <ButtonLink to="/signin" variant="secondary" size="lg">{t("Sign in")}</ButtonLink>
                <ButtonLink to="/estimate/new" variant="primary" size="lg">{t("Get an estimate")}</ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  const t = useT();
  const col = (title: string, links: { to: string; label: string }[]) => (
    <div>
      <p className="text-xs font-medium text-fg">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-fg-muted transition-colors hover:text-fg">{t(l.label)}</Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-page gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm text-fg-muted">{t("Premium estimates for health, motor, home and term-life cover in India.")}</p>
        </div>
        {col(t("Product"), [
          { to: "/estimate/new", label: "Get an estimate" },
          { to: "/estimate/what-if", label: "What-if" },
          { to: "/estimate/ask", label: "Ask about your estimate" },
        ])}
        {col(t("Resources"), [
          { to: "/compare", label: "Compare insurers" },
          { to: "/methodology", label: "Methodology" },
          { to: "/methodology#sources", label: "Data sources" },
          { to: "/methodology#privacy", label: "Privacy" },
          { to: "/terms", label: "Terms" },
        ])}
        {col(t("Insurers"), [
          { to: "/insurers", label: "Portfolio workspace" },
          { to: "/insurers/policies", label: "Sample policies" },
        ])}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-page flex-col gap-3 px-4 py-6 text-2xs leading-relaxed text-fg-subtle sm:px-6 md:flex-row md:justify-between">
          <p className="max-w-2xl">
            {t("InsurTechAI is an independent estimate tool. It isn't an insurer, broker or IRDAI-registered intermediary, and nothing on this site is a quote or a recommendation to buy a particular policy. Premiums shown exclude 18% GST.")}
          </p>
          <p className="shrink-0">© {new Date().getFullYear()} InsurTechAI</p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
