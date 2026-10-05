export type StatusState = "live" | "degraded" | "offline";

/** Result of probing one project URL. */
export type ProjectStatus = {
  slug: string;
  /** null when the project has no public URL to probe. */
  state: StatusState | null;
  latencyMs: number | null;
  /**
   * Would the site let this portfolio show it in an iframe (its X-Frame-Options / CSP frame-ancestors, see frame.ts)?
   * null when there is no URL, or the probe could not read a normal answer.
   */
  embeddable: boolean | null;
  checkedAt: string;
};

export type StatusResponse = {
  checkedAt: string;
  statuses: Record<string, ProjectStatus>;
};
