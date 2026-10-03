"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Recruiter Mode is its own static route (/recruiter), so the toggle is just a link that
 * flips between the two views.
 */
export function RecruiterToggle({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const inRecruiter = usePathname().startsWith("/recruiter");
  return (
    <Link
      href={inRecruiter ? "/" : "/recruiter"}
      onClick={onNavigate}
      className={cn(className)}
      data-track={inRecruiter ? undefined : "recruiter_mode_on"}
    >
      {inRecruiter ? "Full site" : "Recruiter mode"}
    </Link>
  );
}
