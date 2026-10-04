"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNear } from "@/lib/hooks/use-near";
import type { StackExplorer as Explorer } from "./StackExplorer";

const StackExplorer = dynamic(() => import("./StackExplorer").then((m) => m.StackExplorer), { ssr: false });

/** The stack connection map loads just before it scrolls into view. */
export function StackLoader(props: ComponentProps<typeof Explorer>) {
  const [ref, near] = useNear<HTMLDivElement>("2000px 0px");
  return (
    <div ref={ref} data-island="stack" className="island-stack">
      {near ? (
        <StackExplorer {...props} />
      ) : (
        <Skeleton label="Loading the stack map" className="min-h-[inherit] border-0" />
      )}
    </div>
  );
}
