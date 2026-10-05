import { PixelText } from "@/components/ui/PixelText";
import { Reveal } from "@/components/ui/Reveal";

/**
 * LET'S BUILD spelled in contribution squares, lighting up left to right when it scrolls into view
 * (one-shot; final state in the markup, so no JS or reduced motion shows it complete). Decorative.
 * From 640 px up it is the full phrase; below that it is just BUILD, so every square stays readable
 * on a phone (a 58-column phrase in 358 px would be 6 px squares).
 */
export function LetsBuildBanner() {
  return (
    <Reveal threshold={0.4} className="px-banner mt-8 mb-2">
      <PixelText text="LET'S BUILD" className="hidden h-auto w-full sm:block" />
      <PixelText text="BUILD" className="block h-auto w-full sm:hidden" />
    </Reveal>
  );
}
