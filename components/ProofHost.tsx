"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { flashProof, parseProofHash } from "@/lib/proof";

/**
 * Turns an arriving `#proof=<id>` into the scroll + flash, then tidies the URL to a plain `#<id>`.
 * Runs on load, on `hashchange`, and after every client-side navigation (pushState fires no hashchange),
 * and waits a few frames for the target page to render.
 */
export function ProofHost() {
  const pathname = usePathname();

  useEffect(() => {
    let frame = 0;
    const run = () => {
      const id = parseProofHash(window.location.hash);
      if (!id) return;
      let tries = 0;
      const attempt = () => {
        if (flashProof(id)) history.replaceState(null, "", `${window.location.pathname}#${id}`);
        else if (++tries < 30) frame = requestAnimationFrame(attempt);
      };
      frame = requestAnimationFrame(attempt);
    };
    run();
    window.addEventListener("hashchange", run);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", run);
    };
  }, [pathname]);

  return null;
}
