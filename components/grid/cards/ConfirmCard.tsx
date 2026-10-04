"use client";

import { useId, useRef, useState } from "react";
import type { UiPart } from "@/lib/ai/protocol";
import { track } from "@/lib/analytics";
import { MESSAGE_LIMITS, validateMessage, type MessageErrors } from "@/lib/notify/message";
import { mailtoHref } from "@/lib/contact/rules";
import { card, field, label, primary, quiet } from "./styles";

type Confirm = Extract<UiPart, { kind: "confirm" }>;
type Status = "idle" | "sending" | "sent" | "error";

/**
 * The gate in front of every message to Vishal. GRID can only PREPARE this card: the visitor reads it, can edit every
 * field, and nothing leaves the browser until they press Send. Sending goes to /api/grid/message (validated, rate
 * limited, delivered once); it never goes through the model.
 */
export function ConfirmCard({
  part,
  done,
  onResolve,
}: {
  part: Confirm;
  done?: "sent" | "cancelled";
  onResolve?: (d: "sent" | "cancelled") => void;
}) {
  const uid = useId();
  const [name, setName] = useState(part.name);
  const [email, setEmail] = useState(part.email);
  const [message, setMessage] = useState(part.message);
  const [editing, setEditing] = useState(!part.name || !part.email || !part.message);
  const [status, setStatus] = useState<Status>("idle");
  const [local, setLocal] = useState<"sent" | "cancelled" | null>(null);
  const outcome = done ?? local;
  const [errors, setErrors] = useState<MessageErrors>({});
  const [problem, setProblem] = useState("");
  const requestId = useRef<string | null>(null);

  if (outcome === "sent")
    return (
      <section data-grid-card="confirm" aria-label="Message to Vishal" className={`${card} p-3.5`}>
        <p role="status" className="text-sm text-text">
          <span aria-hidden="true" className="mr-2 text-accent">
            ✓
          </span>
          Sent. He&apos;ll reply to {email || "the address you gave"}.
        </p>
      </section>
    );
  if (outcome === "cancelled")
    return (
      <section data-grid-card="confirm" aria-label="Message to Vishal" className={`${card} p-3.5`}>
        <p className="text-sm text-muted">Cancelled. Nothing was sent.</p>
      </section>
    );

  const send = async () => {
    const v = validateMessage({ name, email, message });
    if (!v.ok) {
      setErrors(v.errors);
      setEditing(true);
      return;
    }
    setErrors({});
    setProblem("");
    setStatus("sending");
    requestId.current ??= crypto.randomUUID();
    try {
      const res = await fetch("/api/grid/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...v.data,
          requestId: requestId.current,
          page: window.location.pathname,
          website: "",
        }),
      });
      if (res.ok) {
        track("grid_confirm", { tool: "send_message", outcome: "sent" });
        setStatus("sent");
        setLocal("sent");
        onResolve?.("sent");
        return;
      }
      setStatus("error");
      setProblem(
        res.status === 429
          ? "You've sent a few messages already. Please try again later, or write to him directly."
          : res.status === 400
            ? "That message couldn't be accepted. Please check the fields."
            : "It couldn't be delivered right now. You can write to him directly instead.",
      );
    } catch {
      setStatus("error");
      setProblem("Couldn't reach the server. Check your connection and try again.");
    }
  };

  const mail = mailtoHref(part.mailto, { name, message });
  const sending = status === "sending";

  return (
    <section data-grid-card="confirm" aria-label="Message to Vishal" className={`${card} p-3.5`}>
      <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
        Message to Vishal · review before sending
      </p>

      {editing ? (
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor={`${uid}-n`} className={label}>
              Your name
            </label>
            <input
              id={`${uid}-n`}
              value={name}
              maxLength={MESSAGE_LIMITS.name.max + 20}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${uid}-ne` : undefined}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
            {errors.name ? (
              <p id={`${uid}-ne`} role="alert" className="mt-1 text-xs text-danger">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${uid}-e`} className={label}>
              Your email (so he can reply)
            </label>
            <input
              id={`${uid}-e`}
              type="email"
              value={email}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${uid}-ee` : undefined}
              onChange={(e) => setEmail(e.target.value)}
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
              value={message}
              rows={5}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={`${uid}-mh`}
              onChange={(e) => setMessage(e.target.value)}
              className={`${field} resize-y`}
            />
            <p
              id={`${uid}-mh`}
              role={errors.message ? "alert" : undefined}
              className={`mt-1 text-xs ${errors.message ? "text-danger" : "text-muted"}`}
            >
              {errors.message ?? `${message.length}/${MESSAGE_LIMITS.message.max}`}
            </p>
          </div>
        </div>
      ) : (
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              From
            </dt>
            <dd className="min-w-0 break-words text-text">
              {name} &lt;{email}&gt;
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              Message
            </dt>
            <dd className="min-w-0 break-words whitespace-pre-wrap text-text">{message}</dd>
          </div>
        </dl>
      )}

      {problem ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {problem}{" "}
          {status === "error" ? (
            <a href={mail} className="text-link underline underline-offset-4">
              Email him
            </a>
          ) : null}
        </p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={sending} onClick={() => void send()}>
          {sending ? "Sending…" : "Send"}
        </button>
        <button type="button" className={quiet} disabled={sending} onClick={() => setEditing((e) => !e)}>
          {editing ? "Done editing" : "Edit"}
        </button>
        <button
          type="button"
          className={quiet}
          disabled={sending}
          onClick={() => {
            track("grid_confirm", { tool: "send_message", outcome: "cancelled" });
            setLocal("cancelled");
            onResolve?.("cancelled");
          }}
        >
          Cancel
        </button>
      </div>
      <p className="mt-2.5 font-mono text-[11px] text-muted">
        Goes to Vishal&apos;s phone and inbox. Please don&apos;t share anything sensitive.
      </p>
    </section>
  );
}
