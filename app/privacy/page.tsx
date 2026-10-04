import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { profile } from "@/content/profile";
import { pageJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: "What this site collects (very little), what leaves your browser, and what stays on it.",
  path: "/privacy",
});

/**
 * Plain-language privacy notice. It describes ONLY what the site does today: each phase that adds a
 * feature which handles visitor data (live chat, company links, the presence wall) adds its section
 * here in the same change, so this page never promises or admits more than what is live.
 */
const SECTIONS: ReadonlyArray<{ id: string; title: string; body: string[] }> = [
  {
    id: "short",
    title: "The short version",
    body: [
      "No cookies, no ads, no cross-site tracking, no accounts. Analytics are anonymous and cookieless.",
      "Nothing you type is stored on this site's servers unless a section below says so.",
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    body: [
      "Page views and web-performance numbers are measured with Vercel Web Analytics and Speed Insights. They do not use cookies and do not identify you.",
      "A few named events are counted (for example “résumé downloaded” or “command palette opened”). They carry no message text, no names and no contact details.",
    ],
  },
  {
    id: "contact",
    title: "Contact form",
    body: [
      `What you type in the form (name, email, role or company, message) is emailed to ${profile.name} through Resend so he can reply. It is not kept in a database on this site.`,
      "Please do not send sensitive information.",
    ],
  },
  {
    id: "ai",
    title: "Ask Vishal (AI assistant)",
    body: [
      "When the AI is online, your question and the last few messages of the conversation are sent to Google's Gemini API to write the answer. When it is offline, nothing leaves this site's server and the answer comes straight from the site's own content.",
      "The site does not store your questions. Server logs hold anonymous counts only. The job-description matcher works the same way: the text you paste is processed to extract requirements and is not saved.",
    ],
  },
  {
    id: "abuse",
    title: "Abuse protection",
    body: [
      "To stop automated abuse, requests are rate-limited using a salted hash of your IP address (never the address itself). It lives in memory or in a Redis counter and expires within minutes.",
    ],
  },
  {
    id: "device",
    title: "On your device",
    body: [
      "A few small conveniences use your browser's local storage or session storage: your best score in the games, whether you have already tried the hero terminal, and whether the intro line has played. They never leave your browser and you can clear them any time.",
    ],
  },
  {
    id: "hosting",
    title: "Hosting",
    body: [
      "The site is hosted on Vercel, which keeps ordinary server logs (IP address, user agent, URL) for a limited time to run and secure the service.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="container-page py-12 md:py-20">
      <JsonLd
        data={pageJsonLd("Privacy", "/privacy", [
          { name: "Home", path: "/" },
          { name: "Privacy", path: "/privacy" },
        ])}
      />
      <SectionHeader prefix="§" label="Privacy" id="privacy-label" />
      <h1 className="text-3xl font-semibold md:text-4xl">Privacy</h1>
      <p className="mt-3 max-w-2xl text-muted">
        This is a personal portfolio. It collects as little as it can, and this page says exactly what.
      </p>
      <div className="mt-10 max-w-3xl divide-y divide-border border-y border-border">
        {SECTIONS.map((s) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-h`}
            className="grid gap-2 py-6 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8"
          >
            <h2 id={`${s.id}-h`} className="font-mono text-xs tracking-[0.12em] text-muted uppercase sm:pt-1">
              {s.title}
            </h2>
            <div className="space-y-3 text-[17px] leading-relaxed text-text">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted">
        Questions or a request to remove something?{" "}
        <a href={`mailto:${profile.contact.email}`} className="text-link underline underline-offset-4">
          {profile.contact.email}
        </a>
        .
      </p>
    </div>
  );
}
