import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FilePlus2, Gauge, SlidersHorizontal, MessageSquare, History, LayoutGrid, Table2, Activity,
  BookOpen, FlaskConical, ChevronsUpDown, Check, Menu, LogOut, Sun, Moon, User, Briefcase, ShieldCheck, Scale,
} from "lucide-react";
import { LogoMark } from "../ui/Logo";
import { Kbd } from "../ui/Primitives";
import { Sheet, DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator } from "../ui/Overlays";
import { ButtonLink } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useAssessment } from "../../context/AssessmentContext";
import { useTheme } from "../../context/ThemeContext";
import { useT } from "../../context/I18nContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { gsap, useGSAP, reducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Gauge;
  kbd?: string;
  needsEstimate?: boolean;
  adminOnly?: boolean;
  end?: boolean;
}

const PERSONAL: NavItem[] = [
  { to: "/estimate/new", label: "New estimate", icon: FilePlus2, kbd: "N" },
  { to: "/estimate", label: "Your estimate", icon: Gauge, kbd: "E", needsEstimate: true, end: true },
  { to: "/estimate/what-if", label: "What-if", icon: SlidersHorizontal, kbd: "W", needsEstimate: true },
  { to: "/estimate/ask", label: "Ask", icon: MessageSquare, kbd: "A", needsEstimate: true },
];

const INSURER: NavItem[] = [
  { to: "/insurers", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/insurers/policies", label: "Policies", icon: Table2 },
  { to: "/insurers/model", label: "Claim frequency model", icon: FlaskConical },
  { to: "/insurers/usage", label: "Site usage", icon: Activity, adminOnly: true },
];

function useWorkspace() {
  const { pathname } = useLocation();
  return pathname.startsWith("/insurers") ? "insurer" : "personal";
}

function WorkspaceSwitcher() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus:outline-none data-[state=open]:bg-surface-2">
        <LogoMark className="size-[22px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{ws === "insurer" ? t("Insurer workspace") : "InsurTechAI"}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-fg-subtle" />
      </DropdownTrigger>
      <DropdownContent className="w-[220px]">
        <DropdownLabel>{t("Switch workspace")}</DropdownLabel>
        <DropdownItem icon={<User />} onSelect={() => navigate("/estimate/new")} shortcut={ws === "personal" ? <Check className="size-3.5 text-accent-text" /> : null}>
          {t("Personal")}
        </DropdownItem>
        <DropdownItem icon={<Briefcase />} onSelect={() => navigate("/insurers")} shortcut={ws === "insurer" ? <Check className="size-3.5 text-accent-text" /> : null}>
          {t("Insurer workspace")}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem icon={<BookOpen />} onSelect={() => navigate("/")}>{t("Back to website")}</DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();

  if (!user) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
        <p className="text-xs text-fg-muted">{t("Sign in to save estimates and ask the AI assistant.")}</p>
        <ButtonLink to={`/signin?next=${encodeURIComponent(location.pathname)}`} variant="secondary" size="sm" className="w-full">
          {t("Sign in")}
        </ButtonLink>
      </div>
    );
  }

  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus:outline-none data-[state=open]:bg-surface-2">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold text-fg-muted">{initials}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{user.name}</span>
          <span className="block truncate text-2xs text-fg-subtle">{user.email}</span>
        </span>
      </DropdownTrigger>
      <DropdownContent side="top" className="w-[228px]">
        <DropdownItem icon={<History />} onSelect={() => navigate("/account")}>{t("Saved estimates")}</DropdownItem>
        <DropdownItem icon={<ShieldCheck />} onSelect={() => navigate("/account/security")}>{t("Account and security")}</DropdownItem>
        <DropdownItem icon={theme === "dark" ? <Sun /> : <Moon />} onSelect={toggle}>
          {theme === "dark" ? t("Light theme") : t("Dark theme")}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem
          icon={<LogOut />}
          onSelect={async () => {
            await signOut();
            navigate("/");
          }}
        >
          {t("Sign out")}
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { result } = useAssessment();
  const { user } = useAuth();
  const t = useT();
  return (
    <ul className="space-y-px">
      {items
        .filter((i) => !i.adminOnly || user?.role === "ADMIN")
        .map((item) => {
          const disabled = item.needsEstimate && !result;
          return (
            <li key={item.to}>
              <NavLink
                to={disabled ? "#" : item.to}
                end={item.end}
                onClick={(e) => {
                  if (disabled) e.preventDefault();
                  else onNavigate?.();
                }}
                aria-disabled={disabled}
                title={disabled ? t("Get an estimate first") : undefined}
                className={({ isActive }) =>
                  cn(
                    "group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                    disabled
                      ? "cursor-not-allowed text-fg-subtle/60"
                      : isActive
                        ? "bg-surface-2 text-fg"
                        : "text-fg-muted hover:bg-surface-2/70 hover:text-fg",
                  )
                }
              >
                <item.icon className="size-4 shrink-0 opacity-80" />
                <span className="flex-1 truncate">{t(item.label)}</span>
                {item.kbd && !disabled && <Kbd className="opacity-0 transition-opacity group-hover:opacity-100">{item.kbd}</Kbd>}
              </NavLink>
            </li>
          );
        })}
    </ul>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const ws = useWorkspace();
  const { user } = useAuth();
  const t = useT();
  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <WorkspaceSwitcher />
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-2">
        {ws === "personal" ? (
          <>
            <NavList items={PERSONAL} onNavigate={onNavigate} />
            {user && (
              <>
                <p className="mb-1 mt-5 px-2 text-2xs font-medium text-fg-subtle">{t("Account")}</p>
                <NavList
                  items={[
                    { to: "/account", label: "Saved estimates", icon: History, end: true },
                    { to: "/account/security", label: "Account and security", icon: ShieldCheck },
                  ]}
                  onNavigate={onNavigate}
                />
              </>
            )}
          </>
        ) : (
          <>
            <p className="mb-1 px-2 text-2xs font-medium text-fg-subtle">{t("Sample portfolio")}</p>
            <NavList items={INSURER} onNavigate={onNavigate} />
          </>
        )}
        <p className="mb-1 mt-5 px-2 text-2xs font-medium text-fg-subtle">{t("Reference")}</p>
        <ul>
          <li>
            <Link to="/methodology" onClick={onNavigate} className="flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-fg-muted transition-colors hover:bg-surface-2/70 hover:text-fg">
              <BookOpen className="size-4 opacity-80" /> {t("Methodology")}
            </Link>
          </li>
          <li>
            <Link to="/compare" onClick={onNavigate} className="flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-fg-muted transition-colors hover:bg-surface-2/70 hover:text-fg">
              <Scale className="size-4 opacity-80" /> {t("Compare insurers")}
            </Link>
          </li>
        </ul>
      </nav>
      <div className="space-y-1 border-t border-border p-2">
        <LanguageSwitcher full side="top" align="start" />
        <UserMenu />
      </div>
    </div>
  );
}

/** Single-key shortcuts, ignored while typing or with modifier keys. */
function useShortcuts() {
  const navigate = useNavigate();
  const { result } = useAssessment();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu], [role=listbox]")) return;
      const k = e.key.toLowerCase();
      if (k === "n") navigate("/estimate/new");
      else if (result && k === "e") navigate("/estimate");
      else if (result && k === "w") navigate("/estimate/what-if");
      else if (result && k === "a") navigate("/estimate/ask");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, result]);
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);
  const t = useT();
  useShortcuts();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.fromTo(pageRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", clearProps: "transform" });
    },
    { dependencies: [pathname] },
  );

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 border-r border-border bg-bg-subtle lg:block">
        <SidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} label={t("Navigation")}>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-bg/85 px-3 backdrop-blur-xl lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-fg-muted hover:bg-surface-2" aria-label={t("Open navigation")}>
            <Menu className="size-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <LogoMark className="size-5" />
            <span className="text-sm font-semibold">InsurTechAI</span>
          </Link>
          <LanguageSwitcher className="ml-auto" />
        </div>
        <main ref={pageRef} className="flex-1">
          <Suspense fallback={<div className="flex h-[50vh] items-center justify-center text-fg-subtle"><Spinner /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, meta }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-5 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {meta && <div className="mb-2 flex flex-wrap items-center gap-2">{meta}</div>}
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-fg">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-page px-4 py-6 sm:px-8 sm:py-8", className)}>{children}</div>;
}
