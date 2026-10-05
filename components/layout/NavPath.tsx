"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * The inner pages' mini entrance: the page's path types itself after the wordmark (~/vishalbg/work/talnio), in about
 * 300 ms of CSS steps, each time you arrive on a page. Decorative (the route announcer already says where you are).
 * Rendered only in the browser: the server cannot know a 404's real path, and a guess would not match on hydration.
 */
export function NavPath() {
  const path = usePathname();
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!client || !path || path === "/") return null;
  const text = path.replace(/\/$/, "");
  return (
    <span
      key={text}
      aria-hidden="true"
      className="nav-path hidden h-[1lh] max-w-[24ch] truncate align-top text-muted lg:inline-block"
      style={{ ["--n" as string]: text.length }}
    >
      {text}
    </span>
  );
}
