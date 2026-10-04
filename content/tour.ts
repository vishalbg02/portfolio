import type { Profile } from "@/lib/content/profile-schema";

/**
 * The 60-second tour: six stops down the home page, each a caption written from content/profile.ts (a function of the
 * profile, so a caption can never say something the profile does not). The tour scrolls to the stop, highlights its
 * heading, and shows the caption while GRID's face "speaks". A unit test checks the script's integrity.
 */
export type TourStop = {
  id: string;
  /** The element the tour scrolls to (an id on the home page), or null for the top. */
  sectionId: string | null;
  /** The heading outlined while the stop is shown: a selector inside the section. */
  highlight: string;
  title: string;
  caption: (p: Profile) => string;
};

/** Seconds each stop stays before the next. Six of them make the minute. */
export const STOP_SECONDS = 10;

const list = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const shortCompany = (company: string) => company.split(",")[0]!.replace(/\s*\(.*$/, "");

export const TOUR: TourStop[] = [
  {
    id: "hello",
    sectionId: null,
    highlight: "#hero-title",
    title: "Hello",
    caption: (p) => `${p.name}: ${p.shortRole.toLowerCase()} in ${p.location.split(",")[0]}. ${p.status}.`,
  },
  {
    id: "work",
    sectionId: "work",
    highlight: "h2",
    title: "Work",
    caption: (p) => {
      const live = p.projects.filter((x) => x.live || x.store).map((x) => x.name);
      const rest = p.projects.length - live.length;
      return `${list(live)} ${live.length === 1 ? "is" : "are"} live${
        rest > 0
          ? `, and there ${rest === 1 ? "is" : "are"} ${rest} more project${rest === 1 ? "" : "s"}`
          : ""
      }. Scroll to watch each one.`;
    },
  },
  {
    id: "experience",
    sectionId: "experience",
    highlight: "h2",
    title: "Experience",
    caption: (p) =>
      `${p.experience.length} roles, newest first: ${list(
        p.experience.map((e) => `${e.role} at ${shortCompany(e.company)} (${e.period})`),
      )}.`,
  },
  {
    id: "stack",
    sectionId: "stack",
    highlight: "h2",
    title: "Stack",
    caption: (p) => {
      const areas = Object.values(p.skills);
      return `${areas.reduce((n, a) => n + a.length, 0)} skills in ${areas.length} areas. Point at one to see which project used it.`;
    },
  },
  {
    id: "activity",
    sectionId: "github",
    highlight: "h2",
    title: "Activity",
    caption: () =>
      "Live from GitHub: a contribution calendar with his awards pinned on it, and a 3D city if you prefer.",
  },
  {
    id: "talk",
    sectionId: "contact",
    highlight: "h2",
    title: "Talk to him",
    caption: (p) =>
      `${p.contact.calLink ? "Book a 15-minute call, " : ""}message him live, write to ${p.contact.email}, or ask GRID anything.`,
  },
];
