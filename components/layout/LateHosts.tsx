"use client";

import { useEffect } from "react";
import { CompanyLinkHost } from "@/components/links/CompanyLinkHost";
import { CursorHost } from "@/components/delight/CursorHost";
import { DelightHost } from "@/components/delight/DelightHost";
import { RouteWipe } from "@/components/delight/RouteWipe";
import { ShortcutsHost } from "@/components/palette/ShortcutsHost";
import { TourHost } from "@/components/tour/TourHost";

/**
 * The listeners nothing needs before the page is usable: keyboard navigation and `?`, the terminal and the game keys,
 * the tour, personal company links, the route dissolve and the context cursor. `IdleHosts` loads them as one chunk.
 *
 * `replay` is the key press that made `IdleHosts` load this chunk early. The hosts' listeners are attached by the time
 * this effect runs (children's effects run first), so the key is sent again and is not lost.
 */
export default function LateHosts({ replay }: { replay: string | null }) {
  useEffect(() => {
    if (replay) window.dispatchEvent(new KeyboardEvent("keydown", { key: replay }));
  }, [replay]);

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
