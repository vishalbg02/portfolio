"use client";

import { useSyncExternalStore } from "react";
import type { ProjectStatus, StatusResponse } from "./types";

/**
 * Client store for /api/status. One request is shared by every badge on the page;
 * it starts after hydration so it never blocks render.
 */
type Snapshot = { phase: "idle" | "loading" | "ready" | "error"; statuses: Record<string, ProjectStatus> };

const IDLE: Snapshot = { phase: "idle", statuses: {} };
let snapshot: Snapshot = IDLE;
const listeners = new Set<() => void>();

function set(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

async function load() {
  set({ phase: "loading", statuses: snapshot.statuses });
  try {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as StatusResponse;
    set({ phase: "ready", statuses: data.statuses });
  } catch {
    set({ phase: "error", statuses: {} });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (snapshot.phase === "idle") void load();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => IDLE;

export function useStatuses(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Test hook: reset module state between tests. */
export function __resetStatusStore() {
  snapshot = IDLE;
  listeners.clear();
}
