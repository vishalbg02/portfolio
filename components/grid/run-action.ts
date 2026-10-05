import type { useRouter } from "next/navigation";
import { unlock } from "@/lib/achievements";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { replayIntro } from "@/lib/intro/replay";
import { toast } from "@/lib/toast";
import type { PaletteAction } from "@/components/palette/commands";

/** Carries out a command from the Omnibar (route, external link, download, call, copy, or an app event). */
export async function runAction(action: PaletteAction, router: ReturnType<typeof useRouter>) {
  unlock("omnibar");
  switch (action.type) {
    case "route":
      router.push(action.href);
      break;
    case "external":
      if (action.event) track(action.event);
      window.open(action.href, "_blank", "noopener,noreferrer");
      break;
    case "download": {
      if (action.event) track(action.event);
      const a = document.createElement("a");
      a.href = action.href;
      a.download = action.filename ?? "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      break;
    }
    case "tel":
      window.location.assign(action.href);
      break;
    case "copy": {
      const ok = await copyText(action.text);
      if (ok) {
        if (action.event) track(action.event);
        toast.success(`${action.label} copied`);
      } else {
        toast.error(`Couldn't copy — ${action.text}`);
      }
      break;
    }
    case "event":
      if (action.name === "replay-intro") {
        if (!replayIntro()) toast.info("The intro stays off while your device asks for reduced motion.");
        break;
      }
      window.dispatchEvent(new Event(`app:${action.name}`));
      break;
  }
}
