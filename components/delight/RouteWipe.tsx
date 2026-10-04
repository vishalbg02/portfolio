"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

type Fx = typeof import("@/lib/fx/dissolve");
let fx: Fx | null = null;

/**
 * A new page dissolves in: when the path changes, flat squares cover the viewport and flip off in a wave (see
 * `reveal`). The effect's code is fetched when the browser is idle after load; until it is there (or when the visitor
 * prefers reduced motion) navigation is simply instant, so this never delays anything. Hash and query changes on the
 * same path do nothing.
 */
export function RouteWipe() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    const load = () => void import("@/lib/fx/dissolve").then((m) => (fx = m));
    const idle = (window as Window & typeof globalThis & { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    if (idle) {
      const id = idle(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(load, 2000);
    return () => window.clearTimeout(t);
  }, []);

  useLayoutEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (fx) void fx.reveal(document.body, { fixed: true, cell: 72, ms: 340 });
  }, [pathname]);

  return null;
}
