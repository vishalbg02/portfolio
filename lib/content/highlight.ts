import "server-only";
import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Promise<Highlighter> | undefined;

const LANGS = ["ts", "tsx", "dart", "python"] as const;

/** One shared highlighter per server process. Build-time only for static pages. */
function getHighlighter() {
  highlighter ??= createHighlighter({ themes: ["github-dark"], langs: [...LANGS] });
  return highlighter;
}

/**
 * github-dark HTML. The theme's comment color (#6a737d) fails WCAG AA on our surface,
 * so it is replaced with the design-system muted gray (#8b949e).
 */
export async function highlight(code: string, lang: (typeof LANGS)[number]): Promise<string> {
  const h = await getHighlighter();
  return h.codeToHtml(code, {
    lang,
    theme: "github-dark",
    colorReplacements: { "#6a737d": "#8b949e", "#24292e": "#161b22" },
  });
}
