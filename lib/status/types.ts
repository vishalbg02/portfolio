export type StatusState = "live" | "degraded" | "offline";

/** Result of probing one project URL. */
export type ProjectStatus = {
  slug: string;
  /** null when the project has no public URL to probe. */
  state: StatusState | null;
  latencyMs: number | null;
  checkedAt: string;
};

export type StatusResponse = {
  checkedAt: string;
  statuses: Record<string, ProjectStatus>;
};
