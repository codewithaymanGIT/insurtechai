import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { Landing } from "./pages/landing/Landing";
import { NotFound } from "./pages/NotFound";
import { Spinner } from "./components/ui/Spinner";
import { ScrollTrigger } from "./lib/motion";
import { useAuth } from "./context/AuthContext";
import { useI18n } from "./context/I18nContext";
import { useNavigate } from "react-router-dom";

// Route-level code splitting: charts and the insurer workspace only load when opened.
const named = <T extends Record<string, React.ComponentType>>(p: Promise<T>, key: keyof T) => p.then((m) => ({ default: m[key] }));
const Methodology = lazy(() => named(import("./pages/Methodology"), "Methodology"));
const SignIn = lazy(() => named(import("./pages/SignIn"), "SignIn"));
const Account = lazy(() => named(import("./pages/Account"), "Account"));
const NewEstimate = lazy(() => named(import("./pages/estimate/NewEstimate"), "NewEstimate"));
const Estimate = lazy(() => named(import("./pages/estimate/Estimate"), "Estimate"));
const WhatIf = lazy(() => named(import("./pages/estimate/WhatIf"), "WhatIf"));
const Ask = lazy(() => named(import("./pages/estimate/Ask"), "Ask"));
const InsurerOverview = lazy(() => named(import("./pages/insurers/Overview"), "InsurerOverview"));
const InsurerPolicies = lazy(() => named(import("./pages/insurers/Policies"), "InsurerPolicies"));
const InsurerPolicyDetail = lazy(() => named(import("./pages/insurers/PolicyDetail"), "InsurerPolicyDetail"));
const InsurerModel = lazy(() => named(import("./pages/insurers/Model"), "InsurerModel"));
const InsurerUsage = lazy(() => named(import("./pages/insurers/Usage"), "InsurerUsage"));
const Welcome = lazy(() => named(import("./pages/Welcome"), "Welcome"));
const Terms = lazy(() => named(import("./pages/Terms"), "Terms"));
const Security = lazy(() => named(import("./pages/Security"), "Security"));
const Compare = lazy(() => named(import("./pages/Compare"), "Compare"));

function PageLoading() {
  return (
    <div className="flex h-[50vh] items-center justify-center text-fg-subtle">
      <Spinner />
    </div>
  );
}

// [path, page name, suffix]. Page names and "Insurer workspace" are translated;
// the brand isn't. The landing page puts the brand first.
const TITLES: [RegExp, string, "brand" | "workspace" | "landing"][] = [
  [/^\/$/, "Know what your insurance should cost", "landing"],
  [/^\/methodology/, "Methodology", "brand"],
  [/^\/compare/, "Compare insurers", "brand"],
  [/^\/signin/, "Sign in", "brand"],
  [/^\/account\/security/, "Account and security", "brand"],
  [/^\/account/, "Saved estimates", "brand"],
  [/^\/welcome/, "Create your account", "brand"],
  [/^\/terms/, "Terms", "brand"],
  [/^\/estimate\/new/, "New estimate", "brand"],
  [/^\/estimate\/what-if/, "What-if", "brand"],
  [/^\/estimate\/ask/, "Ask", "brand"],
  [/^\/estimate/, "Your estimate", "brand"],
  [/^\/insurers\/policies\/./, "Policy", "workspace"],
  [/^\/insurers\/policies/, "Policies", "workspace"],
  [/^\/insurers\/usage/, "Site usage", "workspace"],
  [/^\/insurers\/model/, "Claim frequency model", "workspace"],
  [/^\/insurers/, "Overview", "workspace"],
];

function useRouteEffects() {
  const { pathname, hash } = useLocation();
  const { t, lang } = useI18n();
  useEffect(() => {
    const entry = TITLES.find(([re]) => re.test(pathname));
    document.title = !entry
      ? "InsurTechAI"
      : entry[2] === "landing"
        ? `InsurTechAI · ${t(entry[1])}`
        : entry[2] === "workspace"
          ? `${t(entry[1])} · ${t("Insurer workspace")}`
          : `${t(entry[1])} · InsurTechAI`;
  }, [pathname, t, lang]);
  useEffect(() => {
    // Page heights change between routes; let pinned sections re-measure.
    requestAnimationFrame(() => ScrollTrigger.refresh());
    if (hash) {
      requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    } else if (!pathname.startsWith("/estimate") && !pathname.startsWith("/insurers") && pathname !== "/account") {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
}

/** Accounts that haven't finished signup (name + terms) are sent to /welcome. */
function useProfileGate() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const exempt = ["/welcome", "/signin", "/terms", "/methodology", "/compare"].some((p) => pathname.startsWith(p));
    if (user?.needsProfile && !exempt) navigate(`/welcome?next=${encodeURIComponent(pathname)}`, { replace: true });
  }, [user, pathname, navigate]);
}

export default function App() {
  useRouteEffects();
  useProfileGate();
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/methodology" element={<Methodology />} />
      <Route path="/compare" element={<Compare />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/terms" element={<Terms />} />

      <Route element={<AppShell />}>
        <Route path="/estimate/new" element={<NewEstimate />} />
        <Route path="/estimate" element={<Estimate />} />
        <Route path="/estimate/what-if" element={<WhatIf />} />
        <Route path="/estimate/ask" element={<Ask />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/security" element={<Security />} />
        <Route path="/insurers" element={<InsurerOverview />} />
        <Route path="/insurers/policies" element={<InsurerPolicies />} />
        <Route path="/insurers/policies/:applicantId" element={<InsurerPolicyDetail />} />
        <Route path="/insurers/usage" element={<InsurerUsage />} />
        <Route path="/insurers/model" element={<InsurerModel />} />
      </Route>

      {/* Old addresses */}
      <Route path="/assess" element={<Navigate to="/estimate/new" replace />} />
      <Route path="/report" element={<Navigate to="/estimate" replace />} />
      <Route path="/simulator" element={<Navigate to="/estimate/what-if" replace />} />
      <Route path="/advisor" element={<Navigate to="/estimate/ask" replace />} />
      <Route path="/fraud" element={<Navigate to="/estimate" replace />} />
      <Route path="/portfolio" element={<Navigate to="/insurers" replace />} />
      <Route path="/responsible-ai" element={<Navigate to="/methodology" replace />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}
