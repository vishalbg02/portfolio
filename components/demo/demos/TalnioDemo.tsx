"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import { Bar, ProductDemo, type DemoCtx, type DemoStep } from "../ProductDemo";

const tint = { "--c": "var(--id-talnio)" } as CSSProperties;

const STEPS: DemoStep[] = [
  {
    id: "check-in",
    label: "Check in",
    caption: "An employee checks in with their location or by tapping an NFC tag.",
  },
  {
    id: "recorded",
    label: "Attendance recorded",
    caption: "The check-in is written to Cloud Firestore and syncs in real time.",
  },
  {
    id: "report",
    label: "Report generated",
    caption: "Reports are generated automatically as PDF or Excel, feeding workforce analytics.",
  },
];

function Stage({ step }: DemoCtx) {
  return (
    <div className="flex h-full flex-col p-4" style={tint}>
      {step === 0 ? (
        <>
          <p className="font-mono text-[11px] text-muted">Check in</p>
          <div className="stage-grid relative mt-3 grid h-40 place-items-center rounded-sm border border-border">
            <span className="size-16 rounded-pill border border-dashed border-[var(--c)]" />
            <span className="absolute size-3 rounded-pill bg-[var(--c)]" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <span className="rounded-sm border border-[var(--c)] px-3 py-2 text-center text-text">
              Share location
            </span>
            <span className="rounded-sm border border-border px-3 py-2 text-center text-muted">
              Tap NFC tag
            </span>
          </div>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <p className="font-mono text-[11px] text-muted">Attendance</p>
          <div className="mt-3 space-y-2">
            {["Checked in", "Synced", "Recorded"].map((l, i) => (
              <div key={l} className="flex items-center gap-3 rounded-sm border border-border px-3 py-2.5">
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-pill font-mono text-[10px]",
                    i < 3 ? "bg-[var(--c)] text-bg" : "",
                  )}
                >
                  ✓
                </span>
                <span className="font-mono text-[11px] text-text">{l}</span>
                <span className="ml-auto w-16">
                  <Bar />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <p className="font-mono text-[11px] text-muted">Workforce analytics</p>
          <div className="mt-3 flex h-24 items-end gap-2 rounded-sm border border-border p-3">
            {[40, 70, 55, 90, 65, 80].map((h, i) => (
              <i key={i} className="block flex-1 rounded-t-[2px] bg-[var(--c)]" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <span className="rounded-sm border border-[var(--c)] px-3 py-2 text-center text-text">PDF</span>
            <span className="rounded-sm border border-[var(--c)] px-3 py-2 text-center text-text">Excel</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function TalnioDemo({ store }: { store: string | null }) {
  return (
    <ProductDemo
      slug="talnio"
      frame="phone"
      url="Talnio"
      steps={STEPS}
      link={store ? { href: store, label: "Google Play ↗" } : undefined}
    >
      {(ctx) => <Stage {...ctx} />}
    </ProductDemo>
  );
}
