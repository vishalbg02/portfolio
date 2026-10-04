"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import type { ViewerItem } from "./viewer-types";

const MediaViewer = dynamic(() => import("./MediaViewer").then((m) => m.MediaViewer), { ssr: false });

/**
 * Makes a server-rendered grid of thumbnails open the full-screen viewer (a button with data-gallery-open={index}
 * inside). The viewer is a lazy chunk, fetched on the first click.
 */
export function GalleryViewer({
  slug,
  name,
  items,
  children,
}: {
  slug: string;
  name: string;
  items: ViewerItem[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  return (
    <div
      onClick={(e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>("[data-gallery-open]");
        if (!b) return;
        opener.current = b;
        setOpen(Number(b.dataset.galleryOpen));
        track("media_fullscreen", { project: slug });
      }}
    >
      {children}
      {open !== null ? (
        <MediaViewer name={name} items={items} start={open} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}
