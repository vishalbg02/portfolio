"use client";

import { useEffect, useState } from "react";
import { fetchPresence } from "./api";
import type { PresenceInfo } from "./types";

/** Online / away for chips, fetched once after the page is up (the page itself stays static). */
export function usePresence(): PresenceInfo | null {
  const [p, setP] = useState<PresenceInfo | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchPresence().then((v) => alive && setP(v));
    return () => {
      alive = false;
    };
  }, []);
  return p;
}
