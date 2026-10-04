/**
 * Privacy-friendly custom events (Vercel Analytics, no cookies, no PII).
 * `@vercel/analytics` is imported lazily so it never weighs on the initial bundle.
 * Events are no-ops until the <Analytics /> component is mounted (Phase 8).
 */
export type AnalyticsEvent =
  | "resume_download"
  | "recruiter_mode_on"
  | "palette_open"
  | "copy_email"
  | "copy_phone"
  | "chat_question"
  | "jd_match_run"
  | "project_live_click"
  | "contact_submit"
  | "easter_egg_found"
  | "rail_jump"
  | "work_select";

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  void import("@vercel/analytics").then((m) => m.track(event, props)).catch(() => {});
}
