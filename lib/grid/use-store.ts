"use client";

import { useEffect, useSyncExternalStore } from "react";
import { gridStore, type GridState } from "./store";

/** The shared conversation. Loads what was saved and asks once whether the model is online. */
export function useGridStore(): GridState {
  const state = useSyncExternalStore(gridStore.subscribe, gridStore.getState, gridStore.getServerState);
  useEffect(() => {
    gridStore.hydrate();
    void gridStore.checkAi();
  }, []);
  return state;
}
