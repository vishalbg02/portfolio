import type { DemoScene } from "@/lib/grid/demo";
import { routeIntent } from "./router";

/**
 * The questions the Ask section's demo asks, in order. Each is answered by the deterministic router (no model), so
 * they are exactly what GRID returns for a visitor, work with no API key, and need no network at build time.
 */
export const DEMO_QUESTIONS = [
  "Show me Talnio",
  "Where did he use Spring Boot?",
  "Take me to contact",
  "Can I book a call with him?",
] as const;

export async function buildDemoScenes(): Promise<DemoScene[]> {
  const scenes: DemoScene[] = [];
  for (const q of DEMO_QUESTIONS) {
    const routed = await routeIntent(q);
    if (!routed) continue; // never invent an answer: a question the router no longer handles is left out
    scenes.push({
      q,
      text: routed.text,
      sources: routed.sources,
      parts: routed.parts.map((p) => p.part),
      tool: routed.parts[0]?.tool ?? null,
    });
  }
  return scenes;
}
