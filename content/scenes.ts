import { ScenesSchema, type Scene } from "@/lib/content/scene-schema";

/**
 * How each project is told in the Work showcase (desktop: pinned scenes scrubbed by scroll; phone: story cards).
 * Facts come from content/profile.ts: `outcome` and `proof` are checked against it by a unit test. Beat
 * captions only say what is visible in the capture. Golden Verdict's dashboards are private, so its last two
 * beats are labelled illustrations; LanSymphony has no public UI, so its beats are the protocol drawn in code.
 *
 * (The brief also listed "key exchange" for LanSymphony. profile.ts does not say it, so it is not shown.)
 */
const scenes: Scene[] = [
  {
    slug: "golden-verdict",
    frame: "browser",
    frameLabel: "goldenverdict.com",
    outcome: "Production SaaS for Customers, Legal Partners, Managers and Administrators.",
    proof: [
      "Role-based access for four user roles",
      "Admin dashboards for 50+ services",
      "Unique request IDs on Firestore",
    ],
    hero: { type: "clip", id: "gv-scroll" },
    beats: [
      {
        id: "home",
        label: "The home page",
        caption: "One platform for legal and tax compliance, with fixed prices.",
        media: { type: "still", id: "gv-home-desktop" },
      },
      {
        id: "service",
        label: "Read a service",
        caption: "Public service pages, optimised for search.",
        media: { type: "still", id: "gv-service-desktop" },
      },
      {
        id: "steps",
        label: "How it works",
        caption: "From browsing a service to completion, in four steps.",
        media: { type: "still", id: "gv-steps-desktop" },
      },
      {
        id: "track",
        label: "Track REQ-····",
        caption: "Every application gets a unique request ID and automated status updates.",
        media: { type: "illustration", id: "gv-track" },
      },
    ],
    illustrationNote: "The last beat is an illustration: the real dashboards are private.",
  },
  {
    slug: "talnio",
    frame: "phone",
    frameLabel: "Talnio · Android",
    outcome: "Live on Google Play: real-time attendance, analytics and meetings.",
    proof: [
      "Geolocation- and NFC-based attendance",
      "Live video and audio meetings via Agora",
      "Google Generative AI for productivity workflows",
    ],
    hero: { type: "still", id: "tn-dashboard" },
    beats: [
      {
        id: "attendance",
        label: "Check in",
        caption: "Attendance with a location status and Check In / Check Out.",
        media: { type: "still", id: "tn-attendance" },
      },
      {
        id: "tasks",
        label: "Tasks",
        caption: "My Tasks: status, dates and a slide-to-start control.",
        media: { type: "still", id: "tn-tasks" },
      },
      {
        id: "report",
        label: "Daily report",
        caption: "Write and submit the day's report; earlier reports listed below.",
        media: { type: "still", id: "tn-report" },
      },
      {
        id: "leave",
        label: "Approvals",
        caption: "A manager approves or rejects leave requests.",
        media: { type: "still", id: "tn-leave" },
      },
    ],
  },
  {
    slug: "lansymphony",
    frame: "diagram",
    frameLabel: "local network · no server · no internet",
    outcome: "2nd place at the Windsurf × The AI Collective OpenBuild.",
    proof: ["AES-256 encryption", "Automatic peer discovery", "HD video, VoIP audio and screen sharing"],
    hero: { type: "illustration", id: "ls-discover" },
    beats: [
      {
        id: "discover",
        label: "Peers find each other",
        caption: "No server: peers discover each other on the local network by themselves.",
        media: { type: "illustration", id: "ls-discover" },
      },
      {
        id: "encrypt",
        label: "AES-256 on the wire",
        caption: "Everything sent between peers is encrypted with AES-256.",
        media: { type: "illustration", id: "ls-encrypt" },
      },
      {
        id: "calls",
        label: "Video, voice, screen",
        caption: "HD video calling, VoIP audio and screen sharing, side by side.",
        media: { type: "illustration", id: "ls-calls" },
      },
    ],
    illustrationNote: "LanSymphony has no public UI, so this is its protocol drawn in code.",
  },
  {
    slug: "virtual-tour",
    frame: "browser",
    frameLabel: "virtual-tour-opal.vercel.app",
    outcome: "A 360° campus tour with interactive hotspots, live on the web.",
    proof: [
      "Interactive hotspots",
      "Multimedia and smooth navigation controls",
      "Responsive on web and mobile",
    ],
    hero: { type: "clip", id: "vt-browse" },
    beats: [
      {
        id: "landing",
        label: "The landing page",
        caption: "The CHRIST VR Experience: the tour, the team, the project and the credits.",
        media: { type: "still", id: "vt-landing-desktop" },
      },
      {
        id: "about",
        label: "About the project",
        caption: "A project overview and its objectives.",
        media: { type: "still", id: "vt-about-desktop" },
      },
      {
        id: "team",
        label: "Meet the team",
        caption: "The people behind the project.",
        media: { type: "still", id: "vt-team-desktop" },
      },
    ],
  },
];

export const sceneList: Scene[] = ScenesSchema.parse(scenes);
export const sceneFor = (slug: string) => sceneList.find((s) => s.slug === slug);
