import "server-only";
import { features } from "@/lib/env";
import { presenceView } from "./presence";
import { getLiveStore, type LiveStore } from "./store";
import type { PresenceView } from "./types";

/** Whether Vishal is online. Read-only: nothing in this file can send or store a message. */
export async function currentPresence(
  deps: { store: LiveStore; now: () => number } = { store: getLiveStore(), now: Date.now },
): Promise<PresenceView> {
  if (!features.live) return presenceView(null, deps.now(), false);
  return presenceView(await deps.store.getPresence(), deps.now(), true);
}
