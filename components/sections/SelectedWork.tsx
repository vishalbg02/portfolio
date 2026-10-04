import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { WorkShowcase } from "@/components/work/stage/WorkShowcase";

/**
 * Home: the four products as a cinematic showcase. Desktop pins a stage that native scroll scrubs through each
 * project's real captures; a phone gets a deck of story cards. The markup is server-rendered; the only
 * client part is the small controller that follows the scroll (components/work/stage).
 */
export function SelectedWork() {
  return (
    <section id="work" aria-labelledby="work-label" className="container-page section-y">
      <SectionHeader
        prefix="{ }"
        label="Work"
        id="work-label"
        title="Selected work"
        ask="Which of his projects should I look at first, and why?"
      />
      <WorkShowcase />
      <p className="mt-8">
        <Link href="/work" className="font-mono text-sm text-link underline-offset-4 hover:underline">
          All projects <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}
