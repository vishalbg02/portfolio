import {
  MediaManifestSchema,
  type MediaAsset,
  type MediaClip,
  type MediaStill,
} from "@/lib/content/media-schema";
import type { ProjectSlug } from "@/lib/content/profile-schema";

/**
 * The real product captures the Work section shows. `pnpm media` (scripts/capture-media.mts) creates the
 * files in public/media/<slug>/; this list is what it captures, and the alt text every image and clip needs.
 * Alt text describes only what is visible in the capture: no claims, no numbers that are not on screen.
 *
 * Golden Verdict is a client's production site, so every source below is a PUBLIC page (robots.txt allows
 * them). Nothing behind a login is ever captured. LanSymphony has no public UI: its scene is the protocol
 * diagram drawn in code, so it has no entries here.
 */
const GV = "https://www.goldenverdict.com";
const VT = "https://virtual-tour-opal.vercel.app";
const PLAY = "https://play.google.com/store/apps/details?id=com.talnio.talnio";

const browser = (
  slug: ProjectSlug,
  id: string,
  source: string,
  alt: string,
  extra: Partial<MediaStill> = {},
): MediaStill => ({
  id,
  slug,
  kind: "still",
  frame: "browser",
  width: 960,
  height: 600,
  alt,
  source,
  ...extra,
});

const mobile = (slug: ProjectSlug, id: string, source: string, alt: string): MediaStill => ({
  id,
  slug,
  kind: "still",
  frame: "phone",
  width: 390,
  height: 844,
  alt,
  source,
});

/** Talnio's own Play Store screenshots, cropped to the app screen (1× = 262 × 569 css px). */
const talnio = (id: string, alt: string): MediaStill => ({
  id,
  slug: "talnio",
  kind: "still",
  frame: "phone",
  width: 262,
  height: 569,
  alt,
  source: PLAY,
});

const clip = (slug: ProjectSlug, id: string, source: string, alt: string): MediaClip => ({
  id,
  slug,
  kind: "clip",
  frame: "browser",
  width: 960,
  height: 600,
  alt,
  source,
});

const assets: MediaAsset[] = [
  // ── Golden Verdict (public pages only) ──
  browser(
    "golden-verdict",
    "gv-home-desktop",
    `${GV}/`,
    "Golden Verdict home page with the headline “One platform for all your legal & tax compliance”, Get Started and Explore Services buttons, and portraits labelled Chartered Accountant, Company Secretary, Advocate and Tax Consultant.",
  ),
  browser(
    "golden-verdict",
    "gv-steps-desktop",
    `${GV}/`,
    "Golden Verdict’s “From browse to completion — four simple steps” section, showing the first step, Browse Services, and a note that every service shows a fixed price upfront.",
  ),
  browser(
    "golden-verdict",
    "gv-service-desktop",
    `${GV}/gst-registration`,
    "Golden Verdict’s GST Registration page: the headline “You Handle The Business. We Handle The Tax Codes.”, a Get a Free Quote button and a photo of wooden blocks spelling GST.",
  ),
  mobile(
    "golden-verdict",
    "gv-home-mobile",
    `${GV}/`,
    "Golden Verdict’s home page on a phone: the headline “One platform for all your legal & tax compliance” with Get Started and Explore Services buttons.",
  ),
  mobile(
    "golden-verdict",
    "gv-service-mobile",
    `${GV}/gst-registration`,
    "Golden Verdict’s GST Registration page on a phone, with a Get a Free Quote button and a bar at the bottom offering a free consultation.",
  ),
  clip(
    "golden-verdict",
    "gv-scroll",
    `${GV}/`,
    "Screen recording of Golden Verdict’s public home page: it starts on the headline “One platform for all your legal & tax compliance”, then scrolls through the how-it-works steps to the free tools section.",
  ),

  // ── CHRIST University Virtual Tour (the app's own pages; the 360° tour itself is third-party) ──
  browser(
    "virtual-tour",
    "vt-landing-desktop",
    `${VT}/`,
    "CHRIST University VR Experience landing page: a card with the CHRIST logo and four links, Enter VR Tour, Meet The Team, About The Project and Credits, over a blurred campus photo.",
  ),
  browser(
    "virtual-tour",
    "vt-about-desktop",
    `${VT}/about`,
    "The About The Project page of the CHRIST University VR Experience, with a Project Overview paragraph and an Objectives heading over a blurred campus photo.",
  ),
  browser(
    "virtual-tour",
    "vt-team-desktop",
    `${VT}/meet_the_team`,
    "The Meet The Team page of the CHRIST University VR Experience, with portrait cards including Dr. Suresh K, Dr. Ashok Immanuel V, Vishal B G and Alex KH.",
  ),
  mobile(
    "virtual-tour",
    "vt-landing-mobile",
    `${VT}/`,
    "CHRIST University VR Experience landing page on a phone: the CHRIST logo and the four links Enter VR Tour, Meet The Team, About The Project and Credits.",
  ),
  clip(
    "virtual-tour",
    "vt-browse",
    `${VT}/`,
    "Screen recording of the CHRIST University VR Experience site: hovering Enter VR Tour, then opening Meet The Team and About The Project, going back each time.",
  ),

  // ── Talnio (the app's Google Play listing, in listing order) ──
  talnio(
    "tn-login",
    "Talnio sign-in screen: “Welcome to Talnio”, email and password fields and a Sign In button.",
  ),
  talnio(
    "tn-dashboard",
    "Talnio employee dashboard with a welcome banner and quick actions: Team Chat, Check In/Out, My Tasks and Daily Report.",
  ),
  talnio(
    "tn-tasks",
    "Talnio My Tasks screen: a list of tasks with their status, start and due dates, and a slide-to-start control.",
  ),
  talnio(
    "tn-attendance",
    "Talnio attendance screen: “Ready to Check In?”, a location status showing the distance from the office, and Check In and Check Out buttons.",
  ),
  talnio(
    "tn-report",
    "Talnio daily report screen: a text box to write the day’s report, a Submit Report button and a list of previous reports.",
  ),
  talnio(
    "tn-manager",
    "Talnio manager dashboard with quick actions: Team Chat, Check In/Out, Add Employee, Manage Team, Assign Tasks and Attendance Reports.",
  ),
  talnio(
    "tn-leave",
    "Talnio leave approvals screen: leave requests listed with their type and dates, each with Approve and Reject buttons.",
  ),
];

export const media: MediaAsset[] = MediaManifestSchema.parse(assets);

export const mediaFor = (slug: ProjectSlug) => media.filter((m) => m.slug === slug);
export const mediaById = (id: string) => media.find((m) => m.id === id);
