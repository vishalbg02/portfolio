"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNear } from "@/lib/hooks/use-near";
import type { ActivityPanel as Panel } from "./ActivityPanel";

const ActivityPanel = dynamic(() => import("./ActivityPanel").then((m) => m.ActivityPanel), { ssr: false });

/** The activity block (stats, calendar, year switcher) loads just before it scrolls into view. */
export function ActivityLoader({ summary, ...props }: ComponentProps<typeof Panel> & { summary: string }) {
  const [ref, near] = useNear<HTMLDivElement>("2000px 0px");
  return (
    <div ref={ref} data-island="activity" className="island-activity">
      {near ? (
        <ActivityPanel {...props} />
      ) : (
        <Skeleton label="Loading the activity calendar" className="min-h-[inherit] border-0">
          {summary}
        </Skeleton>
      )}
    </div>
  );
}
