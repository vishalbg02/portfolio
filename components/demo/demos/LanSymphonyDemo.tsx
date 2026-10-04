"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import { ProductDemo, type DemoCtx, type DemoStep } from "../ProductDemo";

const tint = { "--c": "var(--id-lansymphony)" } as CSSProperties;

const STEPS: DemoStep[] = [
  {
    id: "discovery",
    label: "Peer discovery",
    caption: "Peers on the same network find each other automatically. No internet and no server.",
  },
  {
    id: "key-exchange",
    label: "Key exchange",
    caption: "The two peers agree a key before anything is sent. Everything after that is AES-256 encrypted.",
  },
  {
    id: "call",
    label: "Encrypted call",
    caption: "HD video calling, VoIP audio and screen sharing, all over the encrypted link.",
  },
];

const PEERS = [
  { x: 18, y: 30 },
  { x: 78, y: 22 },
  { x: 70, y: 74 },
  { x: 24, y: 70 },
];

function Stage({ step }: DemoCtx) {
  return (
    <div className="relative h-full" style={tint}>
      {step < 2 ? (
        <>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
            {PEERS.map((p, i) => (
              <line
                key={i}
                x1="50"
                y1="50"
                x2={p.x}
                y2={p.y}
                stroke={step === 1 && i === 1 ? "var(--c)" : "var(--border-2)"}
                strokeWidth="0.6"
                strokeDasharray={step === 0 ? "2 2" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <span className="absolute top-1/2 left-1/2 grid -translate-1/2 place-items-center rounded-sm border border-[var(--c)] bg-bg px-3 py-2 font-mono text-[11px] text-text">
            You
          </span>
          {PEERS.map((p, i) => (
            <span
              key={i}
              className={cn(
                "absolute -translate-1/2 rounded-sm border bg-bg px-2.5 py-1.5 font-mono text-[10px]",
                step === 1 && i === 1 ? "border-[var(--c)] text-text" : "border-border text-muted",
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              peer {i + 1}
            </span>
          ))}
          {step === 1 ? (
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-sm border border-[var(--c)] bg-bg px-3 py-1 font-mono text-[11px] text-text">
              AES-256 key agreed
            </span>
          ) : (
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[11px] text-muted">
              Peers found
            </span>
          )}
        </>
      ) : (
        <div className="grid h-full grid-cols-[1.4fr_1fr] gap-3 p-4">
          <div className="stage-grid relative grid place-items-center rounded-sm border border-border">
            <span className="size-10 rounded-pill border border-[var(--c)]" />
            <span className="absolute bottom-2 left-2 font-mono text-[10px] text-text">HD video</span>
            <span className="absolute top-2 right-2 inline-flex items-center gap-1 font-mono text-[10px] text-muted">
              AES-256 encrypted
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid flex-1 place-items-center rounded-sm border border-border">
              <span className="flex h-8 items-end gap-1">
                {[40, 90, 60, 100, 50].map((h, i) => (
                  <i key={i} className="block w-1.5 bg-[var(--c)]" style={{ height: `${h}%` }} />
                ))}
              </span>
              <span className="font-mono text-[10px] text-text">VoIP audio</span>
            </div>
            <div className="grid flex-1 place-items-center rounded-sm border border-border font-mono text-[10px] text-text">
              Screen sharing
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LanSymphonyDemo() {
  return (
    <ProductDemo slug="lansymphony" frame="browser" url="LanSymphony — on your local network" steps={STEPS}>
      {(ctx) => <Stage {...ctx} />}
    </ProductDemo>
  );
}
