import { Hero } from "@/components/hero/Hero";
import { IntroLoader } from "@/components/intro/IntroLoader";
import { IntroOverlay } from "@/components/intro/IntroOverlay";
import { JsonLd } from "@/components/seo/JsonLd";
import { homeJsonLd } from "@/lib/seo/jsonld";
import { RailLoader } from "@/components/rail/RailLoader";
import { MeetGrid } from "@/components/sections/MeetGrid";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { LiveGitHub } from "@/components/sections/LiveGitHub";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { Stack } from "@/components/sections/Stack";

const RAIL_SECTIONS = [
  { id: "work", label: "Work" },
  { id: "experience", label: "Experience" },
  { id: "stack", label: "Stack" },
  { id: "github", label: "Activity" },
  { id: "ask", label: "Ask" },
  { id: "contact", label: "Contact" },
];

/**
 * Home: Hero → Work → Experience → Stack → Live GitHub (with award and role milestones on the calendar) → Ask GRID → Contact.
 */
export default function HomePage() {
  return (
    <>
      <IntroOverlay />
      <IntroLoader />
      <JsonLd data={homeJsonLd()} />
      <RailLoader sections={RAIL_SECTIONS} />
      <Hero />

      <SelectedWork />

      <Experience />

      <Stack />

      <LiveGitHub />

      <MeetGrid />

      <Contact />
    </>
  );
}
