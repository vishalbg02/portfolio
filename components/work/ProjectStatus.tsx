import type { Project } from "@/lib/content/profile-schema";
import { StaticBadge, StatusBadge } from "./StatusBadge";

/** Live probe when there is a URL; otherwise a static fact-based badge; "Repo" for code-only projects. */
export function ProjectStatus({ project, bare }: { project: Project; bare?: boolean }) {
  if (project.live) return <StatusBadge slug={project.slug} bare={bare} />;
  if (project.badge) return <StaticBadge label={project.badge} />;
  if (project.repo) return <StaticBadge label="Repo" />;
  return null;
}
