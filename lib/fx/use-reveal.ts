"use client";

import { useCallback } from "react";
import { reveal, type RevealOptions } from "./dissolve";

/** A ref callback for a dialog's content: every time it opens, it dissolves in. */
export function useRevealRef<T extends HTMLElement>(options: RevealOptions = { cell: 48, ms: 260 }) {
  const { cell, ms } = options;
  return useCallback(
    (el: T | null) => {
      if (el) void reveal(el, { cell, ms });
    },
    [cell, ms],
  );
}
