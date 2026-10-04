/**
 * Privacy-friendly custom events (Vercel Analytics, no cookies, no PII).
 * `@vercel/analytics` is imported lazily so it never weighs on the initial bundle.
 * Events are no-ops until the <Analytics /> component is mounted (Phase 8).
 */
export type AnalyticsEvent =
  | "resume_download"
  | "recruiter_mode_on"
  | "copy_email"
  | "copy_phone"
  | "omnibar_open"
  | "grid_question"
  | "grid_tool_used"
  | "grid_mode"
  | "jd_match_run"
  | "project_live_click"
  | "contact_submit"
  | "easter_egg_found"
  | "rail_jump"
  | "scene_view"
  | "media_fullscreen"
  | "hero_terminal_command"
  | "hero_row_expand"
  | "dock_tap"
  | "milestone_open"
  | "demo_launch"
  | "demo_step"
  | "project_ask"
  | "proof_jump"
  | "stack_skill_select";

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  void import("@vercel/analytics").then((m) => m.track(event, props)).catch(() => {});
}
