"use client";

import { useState } from "react";
import type { UiPart } from "@/lib/ai/protocol";
import { ConfirmCard } from "./ConfirmCard";
import { card, primary, quiet } from "./styles";

/** "Book a call": the Cal.com link when he has set one; otherwise an offer to leave a message. */
export function BookCard({ part, mailto }: { part: Extract<UiPart, { kind: "book" }>; mailto: string }) {
  const [message, setMessage] = useState(false);
  return (
    <div className="space-y-3">
      <section data-grid-card="book" aria-label="Book a call" className={`${card} p-3.5`}>
        {part.calLink ? (
          <>
            <p className="text-sm text-text">Pick a time that suits you and he&apos;ll get the invite.</p>
            <a href={part.calLink} target="_blank" rel="noopener noreferrer" className={`${primary} mt-3`}>
              Book a 15-minute call <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens Cal.com in a new tab)</span>
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-text">
              Online booking isn&apos;t set up yet. Leave a message with a few times that suit you and
              he&apos;ll reply.
            </p>
            <button
              type="button"
              className={`${quiet} mt-3`}
              onClick={() => setMessage(true)}
              disabled={message}
            >
              Leave a message
            </button>
          </>
        )}
      </section>
      {message ? (
        <ConfirmCard
          part={{
            kind: "confirm",
            action: "send_message",
            name: "",
            email: "",
            message: "Hi Vishal, I'd like to book a short call. Times that suit me: ",
            mailto,
          }}
        />
      ) : null}
    </div>
  );
}

/** One of his own interview answers, shown as a quote, or an honest "not written yet" with a way to ask him. */
export function InterviewCard({
  part,
  mailto,
}: {
  part: Extract<UiPart, { kind: "interview" }>;
  mailto: string;
}) {
  const [ask, setAsk] = useState(false);
  return (
    <div className="space-y-3">
      <section data-grid-card="interview" aria-label="Interview answer" className={`${card} p-3.5`}>
        <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">{part.question}</p>
        {part.answer ? (
          <figure className="mt-2.5">
            <blockquote className="border-l-2 border-accent pl-3 text-[15px] leading-relaxed whitespace-pre-wrap text-text">
              {part.answer}
            </blockquote>
            <figcaption className="mt-2 font-mono text-[11px] text-muted">In his own words</figcaption>
          </figure>
        ) : (
          <>
            <p className="mt-2.5 text-sm text-text">
              He hasn&apos;t written an answer to this yet, so GRID won&apos;t make one up.
            </p>
            <button type="button" className={`${quiet} mt-3`} onClick={() => setAsk(true)} disabled={ask}>
              Send him this question
            </button>
          </>
        )}
      </section>
      {ask ? (
        <ConfirmCard
          part={{
            kind: "confirm",
            action: "send_message",
            name: "",
            email: "",
            message: `Hi Vishal, a question for you: ${part.question}`,
            mailto,
          }}
        />
      ) : null}
    </div>
  );
}
