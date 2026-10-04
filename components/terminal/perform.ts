import { openChat } from "@/components/chat/ChatLauncher";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { openCosmoStrike } from "@/lib/delight";
import type { TerminalAction } from "@/lib/terminal/commands";
import { toast } from "@/lib/toast";

export type ActionContext = {
  /** Client-side navigation (router.push). */
  navigate: (href: string) => void;
  clear: () => void;
  exit: () => void;
  /** Called before overlays (chat, game) open, e.g. to close the terminal dialog first. */
  beforeOverlay?: () => void;
};

/** Carries out the side effect a terminal command asked for. Shared by the dialog and the hero terminal. */
export function performAction(action: TerminalAction, ctx: ActionContext): void {
  switch (action.type) {
    case "clear":
      ctx.clear();
      break;
    case "exit":
      ctx.exit();
      break;
    case "navigate":
      ctx.exit();
      ctx.navigate(action.href);
      break;
    case "external":
      window.open(action.href, "_blank", "noopener,noreferrer");
      break;
    case "download": {
      const a = document.createElement("a");
      a.href = action.href;
      a.download = action.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      track("resume_download");
      break;
    }
    case "copy":
      void copyText(action.text).then((ok) => {
        if (ok) {
          toast.success(`${action.label} copied`);
          track(action.label === "Email" ? "copy_email" : "copy_phone");
        } else toast.error(`Couldn't copy — ${action.text}`);
      });
      break;
    case "game":
      ctx.beforeOverlay?.();
      window.setTimeout(openCosmoStrike, 150);
      break;
    case "ask":
      ctx.beforeOverlay?.();
      window.setTimeout(() => openChat(action.question), 150);
      break;
  }
}
