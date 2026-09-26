import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, AlertCircle, Sparkles, Calculator } from "lucide-react";
import { ADVISOR_QUESTIONS, type AdvisorQuestionId } from "@insurtechai/shared";
import { PageHeader } from "../../components/shell/AppShell";
import { Tag } from "../../components/ui/Primitives";
import { Button, ButtonLink } from "../../components/ui/Button";
import { EmptyEstimate } from "../../components/estimate/EmptyEstimate";
import { useAssessment } from "../../context/AssessmentContext";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../context/I18nContext";
import { api, ApiError } from "../../lib/api";
import { gsap, reducedMotion } from "../../lib/motion";
import { cn, inr } from "../../lib/utils";

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "answer"; source: "preset" | "ai"; text: string }
  | { id: number; role: "error"; text: string };
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewMsg = DistOmit<Msg, "id">;

const SUGGESTIONS = [
  "Is it worth raising my deductible?",
  "What would an insurer ask me to prove?",
  "How does the no-claim bonus work for me?",
];

function Typing() {
  const t = useT();
  return (
    <div className="flex items-center gap-1 py-2" aria-label={t("Thinking")}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-pulse rounded-full bg-fg-subtle" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

export function Ask() {
  const { applicant, result } = useAssessment();
  const { user, config } = useAuth();
  const t = useT();
  const aiEnabled = config?.ai.enabled ?? true;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [interactionId, setInteractionId] = useState<string | undefined>();
  const [remaining, setRemaining] = useState<number | null>(null);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "end" });
    const last = document.querySelector("[data-msg]:last-of-type");
    if (last && !reducedMotion()) gsap.from(last, { opacity: 0, y: 8, duration: 0.35, ease: "power2.out" });
  }, [msgs.length, pending]);

  if (!applicant || !result) return <EmptyEstimate what={t("Answers are based on your own numbers, so get an estimate first.")} />;

  const push = (m: NewMsg) => setMsgs((prev) => [...prev, { ...m, id: nextId.current++ } as Msg]);

  async function askPreset(id: AdvisorQuestionId, label: string) {
    if (pending) return;
    push({ role: "user", text: label });
    setPending(true);
    try {
      const { answer } = await api.askPreset(id, applicant!);
      push({ role: "answer", source: "preset", text: answer });
    } catch (e) {
      push({ role: "error", text: e instanceof ApiError ? e.message : t("Couldn't get an answer. Try again.") });
    } finally {
      setPending(false);
    }
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || pending || !user) return;
    setInput("");
    push({ role: "user", text: q });
    setPending(true);
    try {
      const res = await api.askChat(applicant!, q, interactionId);
      if (typeof res.remainingToday === "number") setRemaining(res.remainingToday);
      if (res.available && res.reply) {
        push({ role: "answer", source: "ai", text: res.reply });
        if (res.interactionId) setInteractionId(res.interactionId);
      } else {
        push({ role: "error", text: res.error ?? t("The assistant couldn't answer just now.") });
      }
    } catch (e) {
      push({ role: "error", text: e instanceof ApiError ? e.message : t("The assistant couldn't answer just now.") });
    } finally {
      setPending(false);
      taRef.current?.focus();
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col lg:min-h-screen">
      <PageHeader
        title={t("Ask")}
        description={t("Questions about your {amount} estimate. The preset questions are answered straight from your numbers. Anything you type goes to Google Gemini along with your estimate.", { amount: inr(result.premium.finalPremium) })}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-8">
        <div className="flex-1 space-y-6 py-6" aria-live="polite">
          {msgs.length === 0 && (
            <div className="rounded-lg border border-dashed border-border-strong p-6">
              <p className="text-sm text-fg">{t("Start with a preset question, or type your own below.")}</p>
              <p className="mt-1 text-xs text-fg-subtle">{t("Answers explain your estimate. They aren't financial advice or an insurer's decision.")}</p>
              {user && aiEnabled && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(t(s))} className="rounded-md border border-border-strong px-2.5 py-1.5 text-left text-xs text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg">
                      {t(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {msgs.map((m) =>
            m.role === "user" ? (
              <div key={m.id} data-msg className="flex justify-end">
                <p className="max-w-[85%] rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-fg">{m.text}</p>
              </div>
            ) : m.role === "answer" ? (
              <div key={m.id} data-msg className="max-w-[92%]">
                <div className="mb-1.5 flex items-center gap-2">
                  {m.source === "ai" ? (
                    <Tag tone="accent"><Sparkles className="size-3" /> Gemini</Tag>
                  ) : (
                    <Tag><Calculator className="size-3" /> {t("From your numbers")}</Tag>
                  )}
                </div>
                <p className="whitespace-pre-line text-md leading-relaxed text-fg-muted text-pretty">{m.text}</p>
              </div>
            ) : (
              <div key={m.id} data-msg className="flex max-w-[92%] items-start gap-2 rounded-lg border border-danger/25 bg-danger/[0.06] px-3 py-2.5 text-sm text-fg">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
                {m.text}
              </div>
            ),
          )}
          {pending && <Typing />}
          <div ref={endRef} />
        </div>

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-bg/90 px-4 pb-4 pt-3 backdrop-blur-xl sm:-mx-8 sm:px-8">
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {ADVISOR_QUESTIONS.map((q) => (
              <button
                key={q.id}
                disabled={pending}
                onClick={() => askPreset(q.id, t(q.label))}
                className="shrink-0 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-xs text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg disabled:opacity-50"
              >
                {t(q.label)}
              </button>
            ))}
          </div>

          {user && !aiEnabled ? (
            <div className="rounded-lg border border-border-strong bg-surface px-4 py-3 text-sm text-fg-muted">
              {t("Typed questions aren't switched on for this site yet. The preset questions above work.")}
            </div>
          ) : user ? (
            <div className="rounded-lg border border-border-strong bg-surface transition-[border-color,box-shadow] focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15">
              <textarea
                ref={taRef}
                value={input}
                rows={2}
                maxLength={500}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={t("Ask anything about your estimate")}
                aria-label={t("Your question")}
                className="block w-full resize-none bg-transparent px-3.5 pt-3 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
              />
              <div className="flex items-center justify-between px-3 pb-2.5">
                <span className="text-2xs text-fg-subtle">
                  {remaining !== null ? `${t("{n} questions left today", { n: remaining })} · ` : ""}{t("Enter to send, Shift+Enter for a new line")}
                </span>
                <Button variant="primary" size="icon-sm" onClick={() => send()} disabled={!input.trim() || pending} aria-label={t("Send")}>
                  <ArrowUp />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-border-strong bg-surface px-4 py-3 sm:flex-row sm:items-center">
              <p className="text-sm text-fg-muted">{t("Sign in to type your own questions. The presets above work without an account.")}</p>
              <ButtonLink to="/signin?next=/estimate/ask" variant="primary" size="md" className="shrink-0">{t("Sign in")}</ButtonLink>
            </div>
          )}
          <p className={cn("mt-2 text-2xs text-fg-subtle", (!user || !aiEnabled) && "hidden")}>
            {config?.ai.tier === "free"
              ? `${t("Don't type names, phone numbers or other personal details: on the free tier Google may use questions to improve its products.")} `
              : `${t("Gemini can get things wrong, so check anything important with the insurer.")} `}
            <Link to="/methodology#ai" className="underline underline-offset-2 hover:text-fg">{t("What's sent to Gemini")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
