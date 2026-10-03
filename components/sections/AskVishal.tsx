import { LazyChat } from "@/components/chat/LazyChat";
import { SectionHeader } from "@/components/ui/SectionHeader";

/** Home: the AI assistant. Server-rendered shell; the chat itself loads lazily when scrolled near. */
export function AskVishal() {
  return (
    <section id="ask" aria-labelledby="ask-label" className="container-page section-y">
      <SectionHeader prefix="?" label="Ask" id="ask-label" title="Ask Vishal" />
      <p className="mb-6 max-w-2xl text-muted">
        An assistant that answers only from this site&apos;s own content — and shows where each answer came
        from. No guessing; if it doesn&apos;t know, it says so and points you to him.
      </p>
      <div className="max-w-3xl">
        <LazyChat />
      </div>
    </section>
  );
}
