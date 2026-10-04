"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ContextCursor = dynamic(() => import("./ContextCursor"), { ssr: false });

/**
 * Mounts the context cursor only where it makes sense: a mouse or pen (not touch), hover available, motion allowed.
 * Everywhere else its code is never fetched.
 */
export function CursorHost() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine) and (hover: hover)");
    const calm = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const update = () => setOn(fine.matches && calm.matches);
    update();
    fine.addEventListener("change", update);
    calm.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      calm.removeEventListener("change", update);
    };
  }, []);
  return on ? <ContextCursor /> : null;
}
