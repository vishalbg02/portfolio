import { Hero } from "@/components/hero/Hero";
import { JsonLd } from "@/components/seo/JsonLd";
import { homeJsonLd } from "@/lib/seo/jsonld";
import { RailLoader } from "@/components/rail/RailLoader";
import { AskVishal } from "@/components/sections/AskVishal";
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
      <JsonLd data={homeJsonLd()} />
      <RailLoader sections={RAIL_SECTIONS} />
      <Hero />

      <SelectedWork />

      <Experience />

      <Stack />

      <LiveGitHub />

      <AskVishal />

      <Contact />
    </>
  );
}
