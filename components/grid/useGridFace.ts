"use client";

import { useEffect, useState } from "react";
import { FACE_EVENT } from "@/lib/grid/stages";
import type { FaceState } from "./GridFace";

/** GRID's current face, mirrored everywhere it appears (Omnibar, puck, dock): set by the chat as it works. */
export function useGridFace(): FaceState {
  const [face, setFace] = useState<FaceState>("idle");
  useEffect(() => {
    const on = (e: Event) => setFace((e as CustomEvent<FaceState>).detail ?? "idle");
    window.addEventListener(FACE_EVENT, on);
    return () => window.removeEventListener(FACE_EVENT, on);
  }, []);
  return face;
}
