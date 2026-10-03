import { SectionHeader } from "@/components/ui/SectionHeader";
import { profile } from "@/content/profile";
import { features } from "@/lib/env";

/** Understated strip: four small bordered items plus the GATEWAYS line. Hidden with SHOW_RECOGNITION=false. */
export function Recognition() {
  if (!features.recognition) return null;
  return (
    <section id="recognition" aria-labelledby="recognition-label" className="container-page section-y">
      <SectionHeader prefix="::" label="Recognition" id="recognition-label" className="mb-5" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {profile.recognition.map((r) => (
          <li key={r.event} className="rounded-sm border border-border px-3.5 py-3">
            <p className="font-mono text-xs text-text">{r.place}</p>
            <p className="mt-1 text-sm text-muted">{r.event}</p>
            <p className="mt-1.5 font-mono text-[11px] text-muted">{r.date}</p>
          </li>
        ))}
      </ul>
      {profile.leadership.map((l) => (
        <p key={l} className="mt-4 max-w-3xl text-sm text-muted">
          {l}
        </p>
      ))}
    </section>
  );
}
