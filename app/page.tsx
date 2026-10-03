import { Hero } from "@/components/hero/Hero";
import { JsonLd } from "@/components/seo/JsonLd";
import { homeJsonLd } from "@/lib/seo/jsonld";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { LiveGitHub } from "@/components/sections/LiveGitHub";
import { Recognition } from "@/components/sections/Recognition";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { Stack } from "@/components/sections/Stack";

/**
 * Home: Hero → Work → Experience → Stack → Live GitHub → Recognition → (Ask Vishal, Phase 5) → Contact.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={homeJsonLd()} />
      <Hero />

      <SelectedWork />

      <Experience />

      <Stack />

      <LiveGitHub />

      <Recognition />

      <Contact />
    </>
  );
}
