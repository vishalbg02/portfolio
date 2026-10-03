import { profile } from "@/content/profile";

/**
 * /now — what Vishal is doing at the moment. Facts come from profile.ts wherever they exist, so
 * this page can't contradict the rest of the site. Bump `updatedAt` whenever you edit it.
 * Fields set to null are hidden.
 */
const current = profile.experience.find((e) => e.current);
const mca = profile.education[0];

export const now = {
  updatedAt: "2026-10-03",
  // Shown only while a role is marked current in profile.ts (the Social Agent internship ended Mar 2026).
  working: current ? `${current.role} at ${current.company} (${current.period}).` : null,
  studying: mca ? `${mca.degree} at ${mca.school}, ${mca.period}.` : null,
  building:
    "This portfolio: a static Next.js site with an assistant that answers only from its own content, a résumé matcher, and a Ship Log.",
  lookingFor: profile.status,
  reading: null as string | null, // TODO(vishal): a book or paper you're reading
  learning: null as string | null, // TODO(vishal): what you're learning this month
  elsewhere: null as string | null, // TODO(vishal): anything else you want visitors to know
} as const;
