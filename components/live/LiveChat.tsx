"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ConfirmCard } from "@/components/grid/cards/ConfirmCard";
import { card, field, label, primary, quiet } from "@/components/grid/cards/styles";
import { GridFace } from "@/components/grid/GridFace";
import { track } from "@/lib/analytics";
import { fetchPresence, pollLive, saveEmail, sendLive, type SendResult } from "@/lib/live/api";
import { validateLive, type LiveErrors } from "@/lib/live/rules";
import { clearSession, loadSession, saveSession, type LiveSession } from "@/lib/live/session";
import { createPoller } from "@/lib/live/transport";
import { LIVE, type LiveMessage, type PresenceInfo } from "@/lib/live/types";
import { cn } from "@/lib/utils/cn";
import { PresenceChip } from "./PresenceChip";
import { Turnstile, turnstileEnabled } from "./Turnstile";
import { play } from "@/lib/sound";

const NOTICE =
  "Messages go to Vishal's phone. Don't share sensitive information. Threads are deleted after 30 days.";

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const mergeMessages = (prev: LiveMessage[], more: LiveMessage[]) => {
  const byN = new Map(prev.map((m) => [m.n, m]));
  for (const m of more) byN.set(m.n, m);
  return [...byN.values()].sort((a, b) => a.n - b.n);
};

const SEND_ERRORS: Record<Exclude<SendResult, { ok: true }>["reason"], string> = {
  invalid: "That couldn't be sent. Please check the fields.",
  rate_limited: "You've sent a lot of messages. Please wait a little, or write to him directly.",
  send_failed:
    "Couldn't reach him just now, and your message was not sent. Try again, or write to him directly.",
  bot_check_failed: "Please complete the check below, then send again.",
  not_configured: "Live chat isn't available right now.",
  gone: "This conversation has ended.",
  forbidden: "This conversation can't be continued from this browser.",
  busy: "Chat is busy right now. Please leave a message instead.",
  network: "Couldn't reach the server. Check your connection and try again.",
};

/**
 * Message Vishal: a real conversation. The visitor writes here, it arrives in his Telegram, and his reply appears
 * here (asked for every few seconds, see lib/live/transport.ts). If he is away or doesn't answer in two minutes the
 * visitor is asked for an email address so his reply can reach them there. Without the live-chat setup it falls back to
 * "leave a message", which uses GRID's message card.
 */
export default function LiveChat({
  onBack,
  controls,
  prefill,
}: {
  onBack: () => void;
  controls?: ReactNode;
  prefill?: string;
}) {
  const uid = useId();
  const [presence, setPresence] = useState<PresenceInfo | null>(null);
  const [phase, setPhase] = useState<"loading" | "unconfigured" | "compose" | "thread">("loading");
  const [session, setSession] = useState<LiveSession | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<LiveErrors>({});
  const [form, setForm] = useState({ name: "", email: "", org: "", message: prefill ?? "" });
  const [draft, setDraft] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [tokenReset, setTokenReset] = useState(0);
  const [emailSaved, setEmailSaved] = useState<string | null>(null);
  const [needEmail, setNeedEmail] = useState(false);
  const [emailForm, setEmailForm] = useState("");
  const [emailError, setEmailError] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const version = useRef(-1);
  const after = useRef(0);
  const sessionRef = useRef<LiveSession | null>(null);
  const poller = useRef<ReturnType<typeof createPoller> | null>(null);
  const away = presence?.state === "away";

  // presence and any saved thread
  useEffect(() => {
    let alive = true;
    void (async () => {
      const p = await fetchPresence();
      if (!alive) return;
      setPresence(p);
      if (p && !p.configured) return setPhase("unconfigured");
      const s = loadSession();
      if (s) {
        setSession(s);
        sessionRef.current = s;
        setPhase("thread");
      } else setPhase("compose");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const endConversation = useCallback((why: string) => {
    poller.current?.stop();
    clearSession();
    sessionRef.current = null;
    setSession(null);
    setMessages([]);
    version.current = -1;
    after.current = 0;
    setNeedEmail(false);
    setEmailSaved(null);
    setNote(why);
    setPhase("compose");
  }, []);

  // ask for replies while a thread is open
  useEffect(() => {
    if (phase !== "thread" || !session) return;
    const p = createPoller({
      poll: async () => {
        const s = sessionRef.current;
        if (!s) return false;
        const r = await pollLive(s.c, s.k, after.current, version.current);
        if (!r.ok) {
          if (r.gone) endConversation("That conversation has ended (threads are deleted after 30 days).");
          return false;
        }
        version.current = r.v;
        if (!r.changed || r.messages.length === 0) return false;
        after.current = Math.max(after.current, ...r.messages.map((m) => m.n));
        setMessages((prev) => mergeMessages(prev, r.messages));
        const fromVishal = r.messages.some((m) => m.from === "vishal");
        if (fromVishal) play("chime");
        return fromVishal;
      },
    });
    poller.current = p;
    p.start();
    p.nudge(); // load the thread straight away
    const onVisible = () => document.visibilityState === "visible" && p.nudge();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      p.stop();
    };
  }, [phase, session, endConversation]);

  // keep the newest message in view
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, needEmail, emailSaved]);

  // "He hasn't replied yet": two minutes after the last message with no answer, ask for an email (unless we have one)
  const last = messages.at(-1);
  const waitingSince = last?.from === "visitor" ? last.t : null;
  useEffect(() => {
    if (waitingSince === null || emailSaved) return;
    const wait = Math.max(0, LIVE.replyWaitMs - (Date.now() - waitingSince));
    const id = window.setTimeout(() => setNeedEmail(true), wait);
    return () => window.clearTimeout(id);
  }, [waitingSince, emailSaved]);

  const fail = (r: Exclude<SendResult, { ok: true }>) => {
    if (r.reason === "not_configured" || r.reason === "busy") setPhase("unconfigured");
    if (r.reason === "gone" || r.reason === "forbidden") return endConversation(SEND_ERRORS[r.reason]);
    if (r.reason === "bot_check_failed") setTokenReset((n) => n + 1);
    setError(r.reason === "invalid" && r.message ? r.message : SEND_ERRORS[r.reason]);
  };

  const start = async () => {
    const needsEmail = away;
    const v = validateLive(form, { needName: true, needEmail: needsEmail });
    if (!v.ok) return setErrors(v.errors);
    if (turnstileEnabled && !token) return setError(SEND_ERRORS.bot_check_failed);
    setErrors({});
    setError("");
    setSending(true);
    const r = await sendLive({
      ...v.data,
      email: v.data.email || undefined,
      org: v.data.org || undefined,
      page: window.location.pathname,
      website: "",
      turnstile: token ?? undefined,
    });
    setSending(false);
    if (!r.ok) return fail(r);
    const s: LiveSession = { c: r.c, k: r.k, name: v.data.name };
    saveSession(s);
    sessionRef.current = s;
    setSession(s);
    after.current = r.n;
    version.current = -1;
    setMessages([{ n: r.n, from: "visitor", text: v.data.message, t: Date.now() }]);
    setPresence((p) => (p ? { ...p, ...r.presence } : p));
    if (v.data.email) setEmailSaved(v.data.email);
    if (r.presence?.state === "away" && !v.data.email) setNeedEmail(true);
    setPhase("thread");
    play("chime");
    window.dispatchEvent(new Event("app:chat-started"));
    track("live_chat_start");
  };

  const reply = async () => {
    const s = sessionRef.current;
    const v = validateLive(
      { name: "", email: "", org: "", message: draft },
      { needName: false, needEmail: false },
    );
    if (!s) return;
    if (!v.ok) return setError(v.errors.message ?? "");
    setError("");
    setSending(true);
    const r = await sendLive({
      c: s.c,
      k: s.k,
      message: v.data.message,
      page: window.location.pathname,
      website: "",
    });
    setSending(false);
    if (!r.ok) return fail(r);
    after.current = Math.max(after.current, r.n);
    setMessages((prev) =>
      mergeMessages(prev, [{ n: r.n, from: "visitor", text: v.data.message, t: Date.now() }]),
    );
    setDraft("");
    poller.current?.activity();
    play("chime");
    track("live_chat_message");
  };

  const sendEmail = async () => {
    const s = sessionRef.current;
    const e = validateLive(
      { name: "", email: emailForm, org: "", message: "x" },
      { needName: false, needEmail: true },
    );
    if (!s) return;
    if (!e.ok && e.errors.email) return setEmailError(e.errors.email);
    setEmailError("");
    const ok = await saveEmail(s.c, s.k, emailForm.trim(), "");
    if (!ok) return setEmailError("Couldn't save that. Please try again.");
    setEmailSaved(emailForm.trim());
    setNeedEmail(false);
  };

  const unconfigured = useMemo(
    () => (
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted">
          Live chat isn&apos;t switched on right now, but you can leave a message. It goes to his phone and
          inbox, and he replies by email.
        </p>
        <ConfirmCard
          part={{
            kind: "confirm",
            action: "send_message",
            name: "",
            email: "",
            company: "",
            role: "",
            message: prefill ?? "",
            mailto: presence?.email ?? "",
          }}
        />
      </div>
    ),
    [prefill, presence?.email],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-border text-muted transition-colors hover:border-border-2 hover:text-text pointer-coarse:size-11"
          aria-label="Back to GRID"
          title="Back to GRID"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M8.5 3L4.5 7l4 4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <GridFace state={phase === "thread" && sending ? "acting" : "idle"} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm text-text">Message Vishal</p>
          {presence ? (
            <PresenceChip presence={presence} className="max-w-full truncate whitespace-nowrap" />
          ) : (
            <p className="font-mono text-[11px] text-muted">Checking…</p>
          )}
        </div>
        {phase === "thread" ? (
          <button
            type="button"
            onClick={() => endConversation("")}
            className="shrink-0 rounded-sm font-mono text-xs whitespace-nowrap text-muted transition-colors hover:text-text pointer-coarse:min-h-11 pointer-coarse:px-2"
          >
            New chat
          </button>
        ) : null}
        {controls}
      </div>

      {phase === "loading" ? (
        <p role="status" className="p-4 font-mono text-sm text-muted">
          Loading…
        </p>
      ) : phase === "unconfigured" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">{unconfigured}</div>
      ) : phase === "compose" ? (
        <form
          className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          {note ? (
            <p role="status" className="text-sm text-muted">
              {note}
            </p>
          ) : null}
          <p
            className={cn(
              "rounded-sm border px-3 py-2 text-sm",
              away ? "border-border-2 text-text" : "border-accent text-text",
            )}
          >
            {away
              ? `Vishal is away (it's ${presence?.time ?? "late"} in Bengaluru). Leave a message and your email: GRID will deliver it and he'll reply by email.`
              : "He's around. Write your message and he'll usually answer here within minutes."}
          </p>
          <div>
            <label htmlFor={`${uid}-n`} className={label}>
              Your name
            </label>
            <input
              id={`${uid}-n`}
              value={form.name}
              autoComplete="name"
              maxLength={100}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${uid}-ne` : undefined}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={field}
            />
            {errors.name ? (
              <p id={`${uid}-ne`} role="alert" className="mt-1 text-xs text-danger">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${uid}-o`} className={label}>
              Company or role (optional)
            </label>
            <input
              id={`${uid}-o`}
              value={form.org}
              autoComplete="organization"
              maxLength={140}
              onChange={(e) => setForm({ ...form, org: e.target.value })}
              className={field}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-e`} className={label}>
              {away ? "Your email (so he can reply)" : "Your email (optional, so he can reply if you leave)"}
            </label>
            <input
              id={`${uid}-e`}
              type="email"
              value={form.email}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${uid}-ee` : undefined}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={field}
            />
            {errors.email ? (
              <p id={`${uid}-ee`} role="alert" className="mt-1 text-xs text-danger">
                {errors.email}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${uid}-m`} className={label}>
              Message
            </label>
            <textarea
              id={`${uid}-m`}
              value={form.message}
              rows={5}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={`${uid}-mh`}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className={`${field} resize-y`}
            />
            <p
              id={`${uid}-mh`}
              role={errors.message ? "alert" : undefined}
              className={cn("mt-1 text-xs", errors.message ? "text-danger" : "text-muted")}
            >
              {errors.message ?? `${form.message.length}/${LIVE.message.max}`}
            </p>
          </div>
          <Turnstile onToken={setToken} resetKey={tokenReset} />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
              {presence?.email ? (
                <>
                  {" "}
                  <a href={`mailto:${presence.email}`} className="text-link underline underline-offset-4">
                    Email him
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          <button type="submit" className={primary} disabled={sending}>
            {sending ? "Sending…" : "Send to Vishal"}
          </button>
          <p className="font-mono text-[11px] text-muted">{NOTICE}</p>
        </form>
      ) : (
        <>
          <div
            ref={log}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Conversation with Vishal"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
          >
            {messages.map((m, i) =>
              m.from === "visitor" ? (
                <div key={m.n} className="flex flex-col items-end gap-1">
                  <p className="max-w-[85%] rounded-card border border-border bg-surface-2 px-3.5 py-2.5 text-[15px] break-words whitespace-pre-wrap text-text">
                    {m.text}
                  </p>
                  {i === messages.length - 1 ? (
                    <p className="font-mono text-[11px] text-muted">Delivered ✓ {clock(m.t)}</p>
                  ) : null}
                </div>
              ) : (
                <div key={m.n} className="flex max-w-[92%] flex-col items-start gap-1">
                  <p className="font-mono text-[11px] text-accent">Vishal · {clock(m.t)}</p>
                  <p className="rounded-card border border-accent bg-surface px-3.5 py-2.5 text-[15px] break-words whitespace-pre-wrap text-text">
                    {m.text}
                  </p>
                </div>
              ),
            )}
            {emailSaved ? (
              <p role="status" className="font-mono text-xs text-muted">
                He&apos;ll reply to {emailSaved} if you&apos;ve left the site.
              </p>
            ) : null}
            {needEmail && !emailSaved ? (
              <section aria-label="Leave your email" className={`${card} space-y-2.5 p-3.5`}>
                <p className="text-sm text-text">
                  {away
                    ? "He's away, so he'll answer later. Leave your email and the reply will reach you there."
                    : "He hasn't replied yet. Leave your email and he'll answer there."}
                </p>
                <label htmlFor={`${uid}-ae`} className="sr-only">
                  Your email
                </label>
                <input
                  id={`${uid}-ae`}
                  type="email"
                  value={emailForm}
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(emailError)}
                  onChange={(e) => setEmailForm(e.target.value)}
                  className={field}
                />
                {emailError ? (
                  <p role="alert" className="text-xs text-danger">
                    {emailError}
                  </p>
                ) : null}
                <button type="button" className={quiet} onClick={() => void sendEmail()}>
                  Notify me by email
                </button>
              </section>
            ) : null}
          </div>
          <form
            className="border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void reply();
            }}
          >
            <label htmlFor={`${uid}-r`} className="sr-only">
              Message Vishal
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id={`${uid}-r`}
                value={draft}
                rows={2}
                maxLength={LIVE.message.max + 100}
                placeholder="Write a message…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void reply();
                  }
                }}
                className="min-h-11 flex-1 resize-none rounded-sm border border-border bg-bg px-3 py-2 text-[15px] text-text placeholder:text-muted hover:border-border-2 focus:border-accent focus:outline-none"
              />
              <button type="submit" className={primary} disabled={sending || !draft.trim()}>
                Send
              </button>
            </div>
            {error ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {error}
              </p>
            ) : (
              <p className="mt-2 font-mono text-[11px] text-muted">{NOTICE}</p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
