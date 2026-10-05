"use client";

import { useEffect } from "react";
import { CompanyLinkHost } from "@/components/links/CompanyLinkHost";
import { CursorHost } from "@/components/delight/CursorHost";
import { DelightHost } from "@/components/delight/DelightHost";
import { RouteWipe } from "@/components/delight/RouteWipe";
import { ShortcutsHost } from "@/components/palette/ShortcutsHost";
import { TourHost } from "@/components/tour/TourHost";
import type { Replay } from "./IdleHosts";

/**
 * The listeners nothing needs before the page is usable: keyboard navigation and `?`, the terminal and the game keys,
 * the tour, personal company links, the route dissolve and the context cursor. `IdleHosts` loads them as one chunk.
 *
 * `handOver` tells `IdleHosts` the listeners are attached (children's effects run before this one) and returns the
 * keys and requests that arrived before that; they are sent again, in order, so none is lost.
 */
export default function LateHosts({ handOver }: { handOver: () => Replay[] }) {
  useEffect(() => {
    for (const r of handOver()) {
      if ("key" in r) window.dispatchEvent(new KeyboardEvent("keydown", { key: r.key }));
      else window.dispatchEvent(new Event(r.event));
    }
  }, [handOver]);

  return (
    <>
      <ShortcutsHost />
      <DelightHost />
      <RouteWipe />
      <CursorHost />
      <TourHost />
      <CompanyLinkHost />
    </>
  );
}
