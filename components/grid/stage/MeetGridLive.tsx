"use client";

import { useEffect } from "react";
import type { FaceState } from "@/components/grid/GridFace";
import { TOOL_WORKING } from "@/lib/grid/demo";
import {
  FACE_EVENT,
  STAGE_EVENT,
  idlePipeline,
  pipelineReduce,
  type Pipeline,
  type StageSignal,
} from "@/lib/grid/stages";

/** How far (in face units; a square is 5) the eyes move toward the pointer. */
const REACH = 1.4;

/** The strip's words for what just happened, read politely by screen readers. */
function noteFor(p: Pipeline): string {
  if (p.running && p.tool) return `${TOOL_WORKING[p.tool]}…`;
  if (p.router) return "Router: answered straight from the site's content, no model.";
  if (p.steps.retrieve === "done" && p.counts.retrieve !== undefined)
    return `Found ${p.counts.retrieve} passages, kept ${p.counts.rank ?? 0}.`;
  return "";
}

/**
 * The Meet GRID section's live layer, one lazy chunk loaded with the chat (components/grid/LazyGridChat.tsx). It
 * only changes attributes on the server-rendered section, so it renders nothing:
 * - the big face looks toward the pointer while it is over the section, or toward the deck tile that has focus;
 * - the face mirrors GRID's state (FACE_EVENT, from the chat);
 * - "How GRID works" lights each step from the stream's real stage events (STAGE_EVENT, from the store).
 */
export function MeetGridLive() {
  useEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-meet-grid]");
    if (!section) return;
    const faces = [...section.querySelectorAll<SVGElement>("[data-grid-stage] .gf")];
    const strip = section.querySelector<HTMLElement>("[data-pipeline]");
    const note = section.querySelector<HTMLElement>("[data-pipeline-note]");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    // eyes
    let frame = 0;
    const look = (x: number, y: number) => {
      if (still.matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const f of faces) {
          const r = f.getBoundingClientRect();
          if (!r.width) continue;
          const dx = x - (r.left + r.width / 2);
          const dy = y - (r.top + r.height / 2);
          const d = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, d / 260); // close to the face, the eyes move less
          f.style.setProperty("--ex", `${((dx / d) * REACH * k).toFixed(2)}px`);
          f.style.setProperty("--ey", `${((dy / d) * REACH * k).toFixed(2)}px`);
        }
      });
    };
    const rest = () => {
      for (const f of faces) {
        f.style.removeProperty("--ex");
        f.style.removeProperty("--ey");
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") look(e.clientX, e.clientY);
    };
    const onFocus = (e: FocusEvent) => {
      const t = (e.target as Element | null)?.closest<HTMLElement>("[data-grid-run]");
      if (!t) return;
      const r = t.getBoundingClientRect();
      look(r.left + r.width / 2, r.top + r.height / 2);
    };

    // state
    const onFace = (e: Event) => {
      const s = (e as CustomEvent<FaceState>).detail;
      for (const f of faces) f.dataset.state = s;
      section.dataset.gridFace = s;
    };

    // the strip
    let p = idlePipeline();
    const draw = () => {
      if (!strip) return;
      strip.dataset.running = String(p.running);
      strip.dataset.router = String(p.router);
      for (const li of strip.querySelectorAll<HTMLElement>("[data-step]")) {
        const step = li.dataset.step as keyof Pipeline["steps"];
        // the router is not drawn as a step: when it answers, retrieval and ranking show as skipped
        li.dataset.state = p.steps[step] ?? "idle";
        const count = li.querySelector<HTMLElement>("[data-count]");
        const n = p.counts[step];
        if (count) count.textContent = n === undefined ? "" : `· ${n}`;
      }
      if (note) note.textContent = noteFor(p);
    };
    const onStage = (e: Event) => {
      p = pipelineReduce(p, (e as CustomEvent<StageSignal>).detail);
      draw();
    };

    section.addEventListener("pointermove", onMove, { passive: true });
    section.addEventListener("focusin", onFocus);
    section.addEventListener("pointerleave", rest);
    window.addEventListener(FACE_EVENT, onFace);
    window.addEventListener(STAGE_EVENT, onStage);
    section.dataset.live = "";
    return () => {
      cancelAnimationFrame(frame);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("focusin", onFocus);
      section.removeEventListener("pointerleave", rest);
      window.removeEventListener(FACE_EVENT, onFace);
      window.removeEventListener(STAGE_EVENT, onStage);
      delete section.dataset.live;
      rest();
    };
  }, []);
  return null;
}
