import type { StageName, StageState, ToolName } from "@/lib/ai/protocol";
import type { FaceState } from "@/components/grid/GridFace";

/**
 * Where GRID's current request is, for "How GRID works" (the pipeline strip) and every GRID face on the page. The
 * store (lib/grid/store.ts) turns the stream's stage and tool events into these window events; this module only
 * defines them and the pure reducer that draws the strip, so it is tiny and unit-tested.
 */
export const STAGE_EVENT = "grid:stage";
export const FACE_EVENT = "grid:face";

export type StageSignal =
  | { kind: "question" }
  | { kind: "stage"; s: StageName; state: StageState; n?: number }
  | { kind: "tool"; name: ToolName; state: "running" | "done" | "error" }
  | { kind: "end"; error?: boolean };

export type Step = "question" | "route" | "retrieve" | "rank" | "tools" | "answer";
export type StepState = "idle" | "active" | "done" | "skip" | "error";
export type Pipeline = {
  running: boolean;
  steps: Record<Step, StepState>;
  /** Counts shown under a step: passages found (retrieve), kept (rank), tools called. */
  counts: Partial<Record<Step, number>>;
  /** The tool running now, if any (named in the strip). */
  tool: ToolName | null;
  /** The router answered: no retrieval, no model. */
  router: boolean;
};

export const STEPS: Step[] = ["question", "route", "retrieve", "rank", "tools", "answer"];

export const idlePipeline = (): Pipeline => ({
  running: false,
  steps: { question: "idle", route: "idle", retrieve: "idle", rank: "idle", tools: "idle", answer: "idle" },
  counts: {},
  tool: null,
  router: false,
});

export function pipelineReduce(p: Pipeline, sig: StageSignal): Pipeline {
  switch (sig.kind) {
    case "question":
      return {
        ...idlePipeline(),
        running: true,
        steps: { ...idlePipeline().steps, question: "done", route: "active" },
      };
    case "stage": {
      const steps = { ...p.steps };
      const counts = { ...p.counts };
      const state: StepState = sig.state === "start" ? "active" : sig.state;
      steps[sig.s] = state;
      if (sig.n !== undefined) counts[sig.s] = sig.n;
      let router = p.router;
      if (sig.s === "route" && sig.state === "done") router = true;
      // the answer starts: anything still waiting was not needed
      if (sig.s === "answer" && sig.state === "start" && (steps.tools === "idle" || steps.tools === "active"))
        steps.tools = p.counts.tools ? "done" : "skip";
      if (sig.s === "rank" && sig.state === "done" && steps.tools === "idle") steps.tools = "active";
      return { ...p, steps, counts, router };
    }
    case "tool": {
      const steps = {
        ...p.steps,
        tools: sig.state === "running" ? "active" : sig.state === "error" ? "error" : "done",
      } as Record<Step, StepState>;
      const counts = { ...p.counts, tools: (p.counts.tools ?? 0) + (sig.state === "running" ? 1 : 0) };
      return { ...p, steps, counts, tool: sig.state === "running" ? sig.name : null };
    }
    case "end": {
      const steps = { ...p.steps };
      // "waiting for a tool" with none called was not a step that ran
      if (steps.tools === "idle" || (steps.tools === "active" && !p.counts.tools)) steps.tools = "skip";
      for (const k of STEPS) if (steps[k] === "active") steps[k] = sig.error ? "error" : "done";
      return { ...p, running: false, steps, tool: null };
    }
  }
}

/** GRID's face for a pipeline moment: thinking while it searches, acting while a tool runs, speaking as it answers. */
export function faceForPipeline(p: Pipeline): FaceState {
  if (!p.running) return "idle";
  if (p.steps.answer === "active") return "speaking";
  if (p.steps.tools === "active" && p.tool) return "acting";
  return "thinking";
}

export const emitStage = (sig: StageSignal) => {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent<StageSignal>(STAGE_EVENT, { detail: sig }));
};
export const emitFace = (state: FaceState) => {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent<FaceState>(FACE_EVENT, { detail: state }));
};
