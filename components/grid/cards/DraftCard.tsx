"use client";

import { useId, useState } from "react";
import type { UiPart } from "@/lib/ai/protocol";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { ConfirmCard } from "./ConfirmCard";
import { card, field, label, primary, quiet } from "./styles";

type Draft = Extract<UiPart, { kind: "draft" }>;

const TITLE: Record<Draft["draftKind"], string> = {
  interview_invite: "Interview invitation",
  intro: "Introduction",
  project_inquiry: "Project inquiry",
  hackathon_team: "Hackathon teammate",
};

/**
 * A draft for the visitor to edit. It comes from a fixed template (see lib/ai/agent/drafts.ts), with [placeholders]
 * for anything unknown. They can copy it, or send it to Vishal, which opens the same review-and-confirm card.
 */
export function DraftCard({ part, mailto }: { part: Draft; mailto: string }) {
  const uid = useId();
  const [subject, setSubject] = useState(part.subject);
  const [body, setBody] = useState(part.body);
  const [sending, setSending] = useState(false);

  return (
    <div className="space-y-3">
      <section
        data-grid-card="draft"
        aria-label={`Draft: ${TITLE[part.draftKind]}`}
        className={`${card} p-3.5`}
      >
        <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
          Draft · {TITLE[part.draftKind]}
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor={`${uid}-s`} className={label}>
              Subject
            </label>
            <input
              id={`${uid}-s`}
              value={subject}
              maxLength={160}
              onChange={(e) => setSubject(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-b`} className={label}>
              Message
            </label>
            <textarea
              id={`${uid}-b`}
              value={body}
              rows={9}
              onChange={(e) => setBody(e.target.value)}
              className={`${field} resize-y`}
            />
          </div>
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            type="button"
            className={primary}
            onClick={async () => {
              if (await copyText(`${subject}\n\n${body}`)) toast.success("Draft copied");
              else toast.error("Couldn't copy the draft");
            }}
          >
            Copy
          </button>
          <button type="button" className={quiet} onClick={() => setSending(true)} disabled={sending}>
            Send to Vishal
          </button>
        </div>
        <p className="mt-2.5 font-mono text-[11px] text-muted">
          Fill in anything in [brackets] first. GRID wrote nothing about him here.
        </p>
      </section>
      {sending ? (
        <ConfirmCard
          part={{
            kind: "confirm",
            action: "send_message",
            name: "",
            email: "",
            company: "",
            role: "",
            message: body,
            mailto,
          }}
        />
      ) : null}
    </div>
  );
}
