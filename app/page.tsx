import { Hero } from "@/components/hero/Hero";
import { JsonLd } from "@/components/seo/JsonLd";
import { homeJsonLd } from "@/lib/seo/jsonld";
import { RailLoader } from "@/components/rail/RailLoader";
import { AskVishal } from "@/components/sections/AskVishal";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { LiveGitHub } from "@/components/sections/LiveGitHub";
import { Recognition } from "@/components/sections/Recognition";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { Stack } from "@/components/sections/Stack";

const RAIL_SECTIONS = [
  { id: "work", label: "Work" },
  { id: "experience", label: "Experience" },
  { id: "stack", label: "Stack" },
  { id: "github", label: "Activity" },
  { id: "recognition", label: "Recognition" },
  { id: "ask", label: "Ask" },
  { id: "contact", label: "Contact" },
];

/**
 * Home: Hero → Work → Experience → Stack → Live GitHub → Recognition → (Ask Vishal, Phase 5) → Contact.
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

      <Recognition />

      <AskVishal />

      <Contact />
    </>
  );
}
