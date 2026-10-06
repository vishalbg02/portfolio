import type { ProjectSlug } from "@/lib/content/profile-schema";
import type { ArchitectureGraph, GraphLayout } from "./types";

/**
 * Architecture graphs for the four case studies.
 * Node descriptions restate facts from content/profile.ts. The request flows follow the
 * walkthroughs in the project brief.
 * TODO(vishal): review the flows/labels marked "brief" below — they are simplified walkthroughs.
 * LanSymphony's flow is checked against ZeroConnect's code (2026-10-06): UDP discovery, a PBKDF2 key, one TCP session.
 */

const D_NODE = { w: 124, h: 56 };
const M_NODE = { w: 200, h: 48 };

function row(ids: string[], y: number, x0: number, step: number) {
  return Object.fromEntries(ids.map((id, i) => [id, { x: x0 + i * step, y }]));
}
function column(ids: string[], x: number, y0: number, step: number) {
  return Object.fromEntries(ids.map((id, i) => [id, { x, y: y0 + i * step }]));
}

const goldenVerdictIds = ["customer", "app", "auth", "db", "brevo", "admin"];
const goldenVerdict: ArchitectureGraph = {
  slug: "golden-verdict",
  title: "Golden Verdict request flow",
  nodes: [
    {
      id: "customer",
      label: "Customer",
      sub: "one of four roles",
      kind: "actor",
      description:
        "One of four roles. Buys a service, uploads documents and tracks the application with a unique request ID.",
    },
    {
      id: "app",
      label: "Next.js app",
      sub: "TypeScript",
      kind: "service",
      description: "The web app: SEO-optimised public service pages plus a dashboard for each role.",
    },
    {
      id: "auth",
      label: "Auth · RBAC",
      sub: "sessions · CSRF",
      kind: "service",
      description:
        "Role-based access control for Customers, Legal Partners, Managers and Administrators, with CSRF protection and secure session handling.",
    },
    {
      id: "db",
      label: "Firestore",
      sub: "transaction",
      kind: "store",
      description:
        "Service purchases and status updates are written with Firestore transactional operations on a scalable schema. Every application gets a unique request ID.",
    },
    {
      id: "brevo",
      label: "Brevo",
      sub: "invoice · email",
      kind: "external",
      description: "Brevo APIs generate invoices automatically and send email.",
    },
    {
      id: "admin",
      label: "Admin dashboard",
      sub: "50+ services",
      kind: "service",
      description: "Administrators manage 50+ services, users, pricing and workflow assignments.",
    },
  ],
  edges: goldenVerdictIds.slice(1).map((to, i) => ({ from: goldenVerdictIds[i]!, to })),
  flows: [{ id: "request", label: "Service request", path: goldenVerdictIds }],
  layouts: {
    desktop: { width: 900, height: 250, node: D_NODE, positions: row(goldenVerdictIds, 66, 72, 151.2) },
    mobile: {
      width: 340,
      height: 6 * 74 + 8,
      node: M_NODE,
      positions: column(goldenVerdictIds, 170, 36, 74),
    },
  },
};

const talnio: ArchitectureGraph = {
  slug: "talnio",
  title: "Talnio platform flows",
  nodes: [
    {
      id: "client",
      label: "Mobile / Web",
      sub: "Flutter · React 19",
      kind: "actor",
      description: "The Flutter mobile app and the React 19 web app. Attendance uses geolocation and NFC.",
    },
    {
      id: "auth",
      label: "Firebase Auth",
      sub: "sign-in",
      kind: "service",
      description: "Firebase Authentication signs users in on both platforms.",
    },
    {
      id: "db",
      label: "Cloud Firestore",
      sub: "real-time sync",
      kind: "store",
      description: "Real-time sync keeps web and mobile in step.",
    },
    {
      id: "reports",
      label: "Report generator",
      sub: "PDF · Excel",
      kind: "service",
      description: "Automated PDF/Excel reports power workforce analytics.",
    },
    {
      id: "agora",
      label: "Agora SDK",
      sub: "video · audio",
      kind: "external",
      description: "Powers live video and audio meetings.",
    },
    {
      id: "ai",
      label: "Google Gen AI",
      sub: "workflows",
      kind: "external",
      description: "Google Generative AI APIs automate productivity workflows.",
    },
  ],
  edges: [
    { from: "client", to: "auth" },
    { from: "auth", to: "db" },
    { from: "db", to: "reports" },
    { from: "client", to: "agora" },
    { from: "client", to: "ai" },
  ],
  flows: [
    { id: "main", label: "Attendance & reports", path: ["client", "auth", "db", "reports"] },
    { id: "meetings", label: "Meetings", path: ["client", "agora"] },
    { id: "ai", label: "AI automation", path: ["client", "ai"] },
  ],
  layouts: {
    desktop: {
      width: 700,
      height: 300,
      node: D_NODE,
      positions: {
        ...row(["client", "auth", "db", "reports"], 62, 72, 185),
        agora: { x: 72, y: 168 },
        ai: { x: 257, y: 168 },
      },
    },
    mobile: {
      width: 340,
      height: 330,
      node: { w: 150, h: 48 },
      positions: {
        ...column(["client", "auth", "db", "reports"], 92, 36, 76),
        agora: { x: 262, y: 36 },
        ai: { x: 262, y: 112 },
      },
    },
  },
};

const lanSymphonyIds = ["discovery", "keyx", "chan", "streams"];
const lanSymphony: ArchitectureGraph = {
  slug: "lansymphony",
  title: "LanSymphony connection flow",
  nodes: [
    {
      id: "discovery",
      label: "Peer discovery",
      sub: "UDP broadcast",
      kind: "actor",
      description:
        "Every peer broadcasts its name and address on UDP port 9998 every 3 seconds; the others list it. No server, no internet.",
    },
    {
      id: "keyx",
      label: "Shared key",
      sub: "PBKDF2",
      kind: "service",
      description:
        "Both peers derive the same Fernet key from a shared passphrase with PBKDF2-HMAC-SHA256 (100,000 iterations). No key crosses the network.",
    },
    {
      id: "chan",
      label: "TCP session",
      sub: "port 9999",
      kind: "service",
      description:
        "One TCP connection carries every stream as length-prefixed frames. Chat, files and voice are encrypted with Fernet (AES-128 + HMAC); each stream runs on its own thread.",
    },
    {
      id: "streams",
      label: "Video · Voice · Screen",
      sub: "streams",
      kind: "service",
      description:
        "HD video calling with Picture-in-Picture (OpenCV), voice (PyAudio), screen sharing and file transfer up to 100 MB.",
    },
  ],
  edges: lanSymphonyIds.slice(1).map((to, i) => ({ from: lanSymphonyIds[i]!, to })),
  flows: [{ id: "connect", label: "Connect & stream", path: lanSymphonyIds }],
  layouts: {
    desktop: {
      width: 760,
      height: 230,
      node: { w: 150, h: 60 },
      positions: row(lanSymphonyIds, 66, 85, 197),
    },
    mobile: { width: 340, height: 4 * 74 + 8, node: M_NODE, positions: column(lanSymphonyIds, 170, 36, 74) },
  },
};

const virtualTourIds = ["react", "scene", "hotspots", "media"];
const virtualTour: ArchitectureGraph = {
  slug: "virtual-tour",
  title: "Virtual Tour rendering flow",
  nodes: [
    {
      id: "react",
      label: "React app",
      sub: "TypeScript",
      kind: "actor",
      description: "Responsive web app, optimised for web and mobile and deployed on Vercel.",
    },
    {
      id: "scene",
      label: "Three.js scene",
      sub: "360° panorama",
      kind: "service",
      description: "Renders the 360-degree campus panorama with smooth navigation controls.",
    },
    {
      id: "hotspots",
      label: "Hotspot layer",
      sub: "interactive",
      kind: "service",
      description: "Interactive hotspots placed on the panorama.",
    },
    {
      id: "media",
      label: "Media",
      sub: "multimedia",
      kind: "external",
      description: "Multimedia content integrated into the tour.",
    },
  ],
  edges: virtualTourIds.slice(1).map((to, i) => ({ from: virtualTourIds[i]!, to })),
  flows: [{ id: "render", label: "Render & explore", path: virtualTourIds }],
  layouts: {
    desktop: {
      width: 760,
      height: 230,
      node: { w: 150, h: 60 },
      positions: row(virtualTourIds, 66, 85, 197),
    },
    mobile: { width: 340, height: 4 * 74 + 8, node: M_NODE, positions: column(virtualTourIds, 170, 36, 74) },
  },
};

export const graphs: Record<ProjectSlug, ArchitectureGraph> = {
  "golden-verdict": goldenVerdict,
  talnio,
  lansymphony: lanSymphony,
  "virtual-tour": virtualTour,
};

export type { GraphLayout };
