"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { mailtoHref, validateContact, type ContactErrors } from "@/lib/contact/rules";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";

type Values = { name: string; email: string; org: string; message: string; website: string };
type Status = "idle" | "sending" | "sent" | "fallback" | "error";

const EMPTY: Values = { name: "", email: "", org: "", message: "", website: "" };
const input =
  "w-full rounded-sm border bg-bg px-3 py-2.5 text-text placeholder:text-muted transition-colors hover:border-border-2 focus:border-accent focus:outline-none";

function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm text-text">
        {label}
        {optional ? <span className="font-mono text-xs text-muted">optional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContactForm({ toEmail }: { toEmail: string }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState("");
  const form = useRef<HTMLFormElement>(null);

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (k in errors) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    const parsed = validateContact(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = (["name", "email", "message", "org"] as const).find((k) => parsed.errors[k]);
      if (first) form.current?.querySelector<HTMLElement>(`#contact-${first}`)?.focus();
      return;
    }
    setErrors({});
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        setStatus("sent");
        setValues(EMPTY);
        toast.success("Message sent");
        track("contact_submit", { result: "sent" });
      } else if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as {
          issues?: Array<{ path: string; message: string }>;
        } | null;
        const errs: ContactErrors = {};
        for (const i of body?.issues ?? [])
          if (i.path in EMPTY && i.path !== "website") errs[i.path as keyof ContactErrors] ??= i.message;
        setErrors(errs);
        setStatus("idle");
      } else if (res.status === 429) {
        setNote(
          "Too many messages in a short time — please try again in a few minutes, or use the email above.",
        );
        setStatus("error");
        track("contact_submit", { result: "rate_limited" });
      } else {
        setStatus("fallback");
        track("contact_submit", { result: "fallback" });
      }
    } catch {
      setStatus("fallback");
      track("contact_submit", { result: "offline" });
    }
  };

  if (status === "sent") {
    return (
      <div role="status" className="rounded-card border border-accent bg-surface p-6">
        <p className="font-mono text-sm text-accent">✓ Message sent</p>
        <p className="mt-2 text-text">Thanks — I&apos;ll get back to you soon.</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => setStatus("idle")}>
          Send another
        </Button>
      </div>
    );
  }

  if (status === "fallback") {
    const href = mailtoHref(toEmail, values);
    return (
      <div role="status" className="rounded-card border border-border bg-surface p-6">
        <p className="font-mono text-sm text-text">The form can&apos;t send right now.</p>
        <p className="mt-2 text-muted">
          Your message is safe here — send it from your own email app instead:
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={href}
            className="inline-flex h-11 items-center rounded-sm border border-accent bg-accent px-4 font-medium text-bg hover:bg-accent-dim hover:text-text"
          >
            Open in my email app
          </a>
          <Button
            variant="ghost"
            onClick={async () => {
              if (await copyText(values.message)) toast.success("Message copied");
              else toast.error("Couldn't copy");
            }}
          >
            Copy message
          </Button>
          <Button variant="ghost" onClick={() => setStatus("idle")}>
            Back to form
          </Button>
        </div>
      </div>
    );
  }

  const aria = (k: keyof ContactErrors) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `contact-${k}-error` : undefined,
  });

  return (
    <form ref={form} noValidate onSubmit={submit} className="space-y-4" aria-label="Contact form">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact-name" label="Name" error={errors.name}>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={set("name")}
            className={cn(input, errors.name ? "border-danger" : "border-border")}
            {...aria("name")}
          />
        </Field>
        <Field id="contact-email" label="Email" error={errors.email}>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={set("email")}
            className={cn(input, errors.email ? "border-danger" : "border-border")}
            {...aria("email")}
          />
        </Field>
      </div>
      <Field id="contact-org" label="Role / company" optional error={errors.org}>
        <input
          id="contact-org"
          name="org"
          autoComplete="organization"
          value={values.org}
          onChange={set("org")}
          className={cn(input, errors.org ? "border-danger" : "border-border")}
          {...aria("org")}
        />
      </Field>
      <Field id="contact-message" label="Message" error={errors.message}>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          value={values.message}
          onChange={set("message")}
          className={cn(input, "resize-y", errors.message ? "border-danger" : "border-border")}
          {...aria("message")}
        />
      </Field>

      {/* Honeypot: invisible to people and assistive tech; bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            name="website"
            value={values.website}
            onChange={set("website")}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="solid" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send message"}
        </Button>
        <p role="status" className={cn("text-sm", status === "error" ? "text-danger" : "text-muted")}>
          {status === "error" ? note : "Usually replies within a few hours · Bengaluru (IST)"}
        </p>
      </div>
    </form>
  );
}
