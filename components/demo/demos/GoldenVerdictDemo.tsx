"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import { Bar, ProductDemo, type DemoCtx, type DemoRole, type DemoStep } from "../ProductDemo";

const C = "var(--id-golden-verdict)";
const tint = { "--c": C } as CSSProperties;

const STEPS: DemoStep[] = [
  {
    id: "choose",
    label: "Choose service",
    caption: "A customer picks a service and buys it. Purchases are written to Firestore as transactions.",
  },
  {
    id: "upload",
    label: "Upload documents",
    caption: "Documents are uploaded against the purchase, in the same flow.",
  },
  {
    id: "track",
    label: "Track request REQ-····",
    caption: "Every application gets a unique request ID, so its progress can be tracked at any time.",
  },
  {
    id: "status",
    label: "Status update",
    caption: "Status changes are automated, with invoices and emails sent through the Brevo API.",
  },
];

const ROLES: DemoRole[] = [
  { id: "customer", label: "Customer" },
  { id: "partner", label: "Partner" },
  { id: "manager", label: "Manager" },
  { id: "admin", label: "Admin" },
];

/** What each role's sidebar offers. Admin's four items are from the project notes; the others are generic. */
const NAV: Record<string, string[]> = {
  customer: ["Services", "Documents", "Requests"],
  partner: ["Dashboard", "Requests"],
  manager: ["Dashboard", "Requests"],
  admin: ["Services", "Users", "Pricing", "Workflow assignments"],
};

const STATUS = ["Purchased", "Documents received", "In progress", "Updated"];
const PHASES = ["Purchased", "Documents", "In progress", "Done"];

function Timeline({ at }: { at: number }) {
  return (
    <div className="mt-4 flex items-center" style={tint}>
      {PHASES.map((p, i) => (
        <div key={p} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "size-3 rounded-pill border-2",
                i <= at ? "border-[var(--c)] bg-[var(--c)]" : "border-border-2 bg-bg",
              )}
            />
            <span className={cn("font-mono text-[10px]", i <= at ? "text-text" : "text-muted")}>{p}</span>
          </div>
          {i < PHASES.length - 1 ? (
            <span className={cn("mx-1 mb-4 h-px flex-1", i < at ? "bg-[var(--c)]" : "bg-border-2")} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CustomerPanel({ step }: { step: number }) {
  if (step === 0)
    return (
      <div>
        <p className="font-mono text-[11px] text-muted">Choose a service</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={cn(
                "space-y-2 rounded-sm border p-2.5 transition-colors",
                i === 1 ? "border-[var(--c)] bg-surface" : "border-border",
              )}
              style={tint}
            >
              <Bar w="60%" accent={i === 1} />
              <Bar w="90%" />
              <Bar w="45%" />
            </div>
          ))}
        </div>
        <span
          className="mt-3 inline-block rounded-sm border border-[var(--c)] px-3 py-1 font-mono text-[11px] text-text"
          style={tint}
        >
          Buy
        </span>
      </div>
    );
  if (step === 1)
    return (
      <div>
        <p className="font-mono text-[11px] text-muted">Upload documents</p>
        <div className="mt-3 rounded-sm border border-dashed border-border-2 px-3 py-4 text-center font-mono text-[11px] text-muted">
          Drop documents here
        </div>
        {[100, 62].map((w, i) => (
          <div key={i} className="mt-3 flex items-center gap-3" style={tint}>
            <span className="font-mono text-[11px] text-text">document-{i + 1}</span>
            <span className="h-1.5 flex-1 rounded-pill bg-surface-2">
              <i className="block h-full rounded-pill bg-[var(--c)]" style={{ width: `${w}%` }} />
            </span>
          </div>
        ))}
      </div>
    );
  return (
    <div>
      <p className="font-mono text-[11px] text-muted">{step === 2 ? "Your request" : "Request updated"}</p>
      <p className="mt-2 inline-block rounded-sm border border-border-2 px-2.5 py-1 font-mono text-sm text-text">
        REQ-····
      </p>
      <Timeline at={step === 2 ? 2 : 3} />
      {step === 3 ? (
        <p
          className="mt-4 inline-flex items-center gap-2 rounded-sm border border-[var(--c)] px-3 py-1.5 font-mono text-[11px] text-text"
          style={tint}
        >
          <span aria-hidden="true" className="size-1.5 rounded-pill bg-[var(--c)]" />
          Status updated · email sent
        </p>
      ) : null}
    </div>
  );
}

function RolePanel({ role, step }: { role: string; step: number }) {
  return (
    <div>
      <p className="font-mono text-[11px] text-muted">
        {role === "admin" ? "Admin dashboard" : role === "manager" ? "Manager view" : "Legal Partner view"}
      </p>
      {role === "admin" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ["Services", "50+"],
            ["Users", ""],
            ["Pricing", ""],
            ["Workflow assignments", ""],
          ].map(([label, n]) => (
            <div key={label} className="rounded-sm border border-border p-2.5">
              <p className="font-mono text-[10px] text-muted">{label}</p>
              {n ? <p className="mt-1 text-lg font-semibold text-text">{n}</p> : <Bar w="55%" />}
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 rounded-sm border border-border">
        <div className="flex items-center justify-between gap-3 px-3 py-2 font-mono text-[11px]">
          <span className="text-text">REQ-····</span>
          <span className="text-[var(--c)]" style={tint}>
            {STATUS[step]}
          </span>
        </div>
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          <Bar w="70%" />
          <Bar w="40%" />
        </div>
      </div>
    </div>
  );
}

function Stage({ step, roleId }: DemoCtx) {
  const role = roleId ?? "customer";
  return (
    <div className="flex h-full">
      <nav className="w-[30%] max-w-[150px] shrink-0 space-y-1 border-r border-border p-3">
        <p className="mb-2 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">{role}</p>
        {NAV[role]!.map((item, i) => (
          <p
            key={item}
            className={cn(
              "rounded-sm px-2 py-1 font-mono text-[10px]",
              i === 0 ? "bg-surface text-text" : "text-muted",
            )}
          >
            {item}
          </p>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-hidden p-4">
        {role === "customer" ? <CustomerPanel step={step} /> : <RolePanel role={role} step={step} />}
      </div>
    </div>
  );
}

export function GoldenVerdictDemo({ live }: { live: string }) {
  return (
    <ProductDemo
      slug="golden-verdict"
      frame="browser"
      url="goldenverdict.com"
      steps={STEPS}
      roles={ROLES}
      link={{ href: live, label: "Visit live site ↗" }}
    >
      {(ctx) => <Stage {...ctx} />}
    </ProductDemo>
  );
}
