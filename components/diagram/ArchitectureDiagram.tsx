"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { identityBg } from "@/components/work/identity";
import { cn } from "@/lib/utils/cn";
import { edgeEndpoints, flowSegments, progressAt } from "./geometry";
import type { ArchitectureGraph, GraphLayout, GraphNode } from "./types";

const SEGMENT_MS = 950;
const STEP_MS_REDUCED = 800;

type Run = {
  flowId: string;
  /** 0…segments (animated) */
  progress: number;
  /** true while the packet is in flight or stepping */
  active: boolean;
};

const identityVar = (slug: string) => `var(--id-${slug})`;

function NodeShape({
  node,
  layout,
  x,
  y,
  stroke,
}: {
  node: GraphNode;
  layout: GraphLayout;
  x: number;
  y: number;
  stroke: string;
}) {
  const { w, h } = layout.node;
  const common = {
    x: x - w / 2,
    y: y - h / 2,
    width: w,
    height: h,
    fill: "var(--surface)",
    stroke,
    strokeWidth: 1.5,
  };
  const rx = node.kind === "actor" ? h / 2 : 8;
  return (
    <>
      <rect {...common} rx={rx} strokeDasharray={node.kind === "external" ? "5 4" : undefined} />
      {node.kind === "store" ? (
        <>
          <line
            x1={x - w / 2 + 10}
            y1={y - h / 2 + 8}
            x2={x + w / 2 - 10}
            y2={y - h / 2 + 8}
            stroke={stroke}
            strokeOpacity="0.5"
          />
        </>
      ) : null}
    </>
  );
}

export function ArchitectureDiagram({ graph }: { graph: ArchitectureGraph }) {
  const uid = useId();
  const accent = identityVar(graph.slug);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [flowId, setFlowId] = useState(graph.flows[0]!.id);
  const [run, setRun] = useState<Run | null>(null);
  const raf = useRef(0);
  const timers = useRef<number[]>([]);

  const flow = graph.flows.find((f) => f.id === flowId) ?? graph.flows[0]!;
  const nodeById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const activeNodeId = pinned ?? focused ?? hovered;

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => stop, [stop]);

  const start = () => {
    stop();
    const segments = flowSegments(graph.layouts.desktop, flow.path);
    const n = segments.length;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      // No travelling packet: light the nodes one at a time.
      flow.path.forEach((_, i) => {
        timers.current.push(
          window.setTimeout(
            () => setRun({ flowId: flow.id, progress: i, active: true }),
            i * STEP_MS_REDUCED,
          ),
        );
      });
      timers.current.push(
        window.setTimeout(() => {
          setRun({ flowId: flow.id, progress: n, active: false });
          timers.current.push(window.setTimeout(() => setRun(null), 2500));
        }, flow.path.length * STEP_MS_REDUCED),
      );
      return;
    }

    const t0 = performance.now();
    setRun({ flowId: flow.id, progress: 0, active: true });
    const tick = (now: number) => {
      const progress = Math.min(n, (now - t0) / SEGMENT_MS);
      if (progress >= n) {
        setRun({ flowId: flow.id, progress: n, active: false });
        timers.current.push(window.setTimeout(() => setRun(null), 2500));
        return;
      }
      setRun({ flowId: flow.id, progress, active: true });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const selectFlow = (id: string) => {
    stop();
    setRun(null);
    setFlowId(id);
  };

  // Which nodes/edges are lit, and caption text.
  const runFlow = run ? (graph.flows.find((f) => f.id === run.flowId) ?? flow) : null;
  const reducedStep = run && Number.isInteger(run.progress);
  const segmentsDesktop = runFlow ? flowSegments(graph.layouts.desktop, runFlow.path) : [];
  const state = run && runFlow ? progressAt(segmentsDesktop, run.progress) : null;
  const reached = new Set<string>();
  if (state && runFlow) {
    const upto = reducedStep && run && run.active ? run.progress : state.reached;
    runFlow.path.slice(0, upto + 1).forEach((id) => reached.add(id));
  }
  const litEdges = new Set<string>();
  if (runFlow) {
    for (let i = 0; i < runFlow.path.length - 1; i++) {
      if (reached.has(runFlow.path[i]!) && reached.has(runFlow.path[i + 1]!))
        litEdges.add(`${runFlow.path[i]}>${runFlow.path[i + 1]}`);
    }
  }
  const stepIndex =
    state && runFlow
      ? Math.min(runFlow.path.length - 1, reducedStep && run?.active ? run.progress : state.nodeIndex)
      : -1;
  const stepNode = stepIndex >= 0 && runFlow ? nodeById[runFlow.path[stepIndex]!] : null;
  const caption =
    run && runFlow && stepNode
      ? run.active
        ? `${runFlow.label} — step ${stepIndex + 1} of ${runFlow.path.length}: ${stepNode.label}`
        : `${runFlow.label} — complete. The request reached ${nodeById[runFlow.path.at(-1)!]!.label}.`
      : "Hover or focus a component to see what it does, or run a request through the system.";

  const renderSvg = (key: "desktop" | "mobile") => {
    const layout = graph.layouts[key];
    const segs = runFlow ? flowSegments(layout, runFlow.path) : [];
    const packet =
      run && run.active && !reducedStep && runFlow ? progressAt(segs, run.progress).packet : null;
    const markerId = `${uid}-${key}-arrow`;
    const markerLitId = `${uid}-${key}-arrow-lit`;
    const tipNode = activeNodeId ? nodeById[activeNodeId] : null;
    const tipPos = tipNode ? layout.positions[tipNode.id] : null;

    return (
      <div className={cn("relative", key === "desktop" ? "hidden md:block" : "md:hidden")}>
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="group"
          aria-label={`${graph.title}. Interactive diagram — press Tab to move between components.`}
          className="h-auto w-full"
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--border-2)" />
            </marker>
            <marker
              id={markerLitId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill={accent} />
            </marker>
          </defs>

          {graph.edges.map((e) => {
            const [p0, p1] = edgeEndpoints(layout, e.from, e.to);
            const lit = litEdges.has(`${e.from}>${e.to}`);
            return (
              <line
                key={`${e.from}>${e.to}`}
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke={lit ? accent : "var(--border-2)"}
                strokeWidth={lit ? 2 : 1.5}
                markerEnd={`url(#${lit ? markerLitId : markerId})`}
              />
            );
          })}

          {graph.nodes.map((node) => {
            const pos = layout.positions[node.id]!;
            const isActive = activeNodeId === node.id;
            const isReached = reached.has(node.id);
            const stroke = isActive || isReached ? accent : "var(--border-2)";
            return (
              <g
                key={node.id}
                tabIndex={0}
                role="button"
                aria-label={`${node.label}${node.sub ? ` ${node.sub}` : ""}. ${node.description}`}
                aria-pressed={pinned === node.id}
                aria-describedby={isActive ? `${uid}-${key}-tip` : undefined}
                className="cursor-pointer outline-none [&:focus-visible>rect:first-of-type]:stroke-[3]"
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered((h) => (h === node.id ? null : h))}
                onFocus={() => setFocused(node.id)}
                onBlur={() => setFocused((f) => (f === node.id ? null : f))}
                onClick={() => setPinned((p) => (p === node.id ? null : node.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPinned((p) => (p === node.id ? null : node.id));
                  } else if (e.key === "Escape") {
                    setPinned(null);
                    setFocused(null);
                    setHovered(null);
                  }
                }}
              >
                <NodeShape node={node} layout={layout} x={pos.x} y={pos.y} stroke={stroke} />
                {/* One <text> with a literal space between spans, so the visible text matches the accessible name. */}
                <text x={pos.x} textAnchor="middle">
                  <tspan
                    x={pos.x}
                    y={pos.y + (node.sub ? -3 : 4)}
                    fontSize="12.5"
                    fontWeight="600"
                    fill="var(--text)"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {node.label}
                  </tspan>
                  {node.sub ? (
                    <>
                      {" "}
                      <tspan
                        x={pos.x}
                        y={pos.y + 13}
                        fontSize="10"
                        fill="var(--muted)"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {node.sub}
                      </tspan>
                    </>
                  ) : null}
                </text>
              </g>
            );
          })}

          {packet ? (
            <g pointerEvents="none">
              <circle cx={packet.x} cy={packet.y} r="9" fill={accent} fillOpacity="0.25" />
              <circle cx={packet.x} cy={packet.y} r="5" fill={accent} />
            </g>
          ) : null}
        </svg>

        {tipNode && tipPos ? (
          <div
            id={`${uid}-${key}-tip`}
            role="tooltip"
            className={cn(
              "pointer-events-none absolute z-20 rounded-sm border border-border-2 bg-bg p-3 text-sm",
              // Narrow screens: span the diagram so the tooltip can never clip. Desktop: sit under the node.
              key === "mobile" ? "inset-x-0" : "w-[min(280px,88%)] -translate-x-1/2",
            )}
            style={{
              ...(key === "mobile" ? {} : { left: `clamp(24%, ${(tipPos.x / layout.width) * 100}%, 76%)` }),
              top: `${((tipPos.y + layout.node.h / 2 + 10) / layout.height) * 100}%`,
            }}
          >
            <p className="font-mono text-xs text-text">{tipNode.label}</p>
            <p className="mt-1 text-muted">{tipNode.description}</p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <figure className="my-8 rounded-card border border-border bg-surface p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 font-mono text-xs text-muted">
          <span aria-hidden="true" className={cn("size-2 rounded-pill", identityBg[graph.slug])} />
          architecture
        </span>
        {graph.flows.length > 1 ? (
          <div role="group" aria-label="Choose a request flow" className="flex flex-wrap gap-1.5">
            {graph.flows.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={f.id === flowId}
                onClick={() => selectFlow(f.id)}
                className={cn(
                  "h-7 rounded-pill border px-3 font-mono text-xs transition-colors",
                  f.id === flowId
                    ? "border-accent text-accent"
                    : "border-border text-muted hover:border-border-2 hover:text-text",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={start}
          disabled={run?.active}
          className="ml-auto inline-flex h-8 items-center gap-2 rounded-sm border border-accent px-3 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg disabled:pointer-events-none disabled:opacity-50"
        >
          {run?.active ? "Running…" : "Run request"} <span aria-hidden="true">▶</span>
        </button>
      </div>

      {renderSvg("desktop")}
      {renderSvg("mobile")}

      <figcaption className="mt-4 min-h-6 font-mono text-xs text-muted" aria-live="polite">
        {caption}
      </figcaption>

      {/* Text-only description for screen readers (and no-JS readers of the DOM). */}
      <div className="sr-only">
        <h3>Text version of the {graph.title} diagram</h3>
        {graph.flows.map((f) => (
          <div key={f.id}>
            <p>{f.label}:</p>
            <ol>
              {f.path.map((id) => (
                <li key={id}>
                  {nodeById[id]!.label} — {nodeById[id]!.description}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </figure>
  );
}
