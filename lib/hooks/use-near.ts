"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True once the element is within `rootMargin` of the viewport (and stays true). Used to load a heavy
 * island just before it scrolls into view, so its code never counts toward the first load. Without
 * IntersectionObserver (very old browsers) it simply loads.
 */
export function useNear<T extends Element>(rootMargin = "900px 0px") {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, rootMargin]);
  return [ref, near] as const;
}
