import type { MetadataRoute } from "next";
import { profile } from "@/content/profile";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${profile.name} — ${profile.shortRole}`,
    short_name: profile.name,
    description:
      "Portfolio of Vishal B G: full-stack developer in Bengaluru. Projects, résumé and an assistant that answers questions about his work.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d1117",
    theme_color: "#0d1117",
    lang: "en-IN",
    categories: ["portfolio", "developer"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Résumé", url: "/resume" },
      { name: "Work", url: "/work" },
      { name: "Recruiter mode", url: "/recruiter" },
    ],
  };
}
