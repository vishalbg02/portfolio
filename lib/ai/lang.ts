/**
 * The language a visitor can choose for GRID's replies (and for voice). "auto" means: answer in the language the
 * question is written in (GRID already does). A choice changes the language of the wording only: every fact, project
 * name, technology name and number stays exactly as it is.
 */
export const LANGS = ["auto", "en", "kn", "hi"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABEL: Record<Lang, string> = { auto: "Auto", en: "English", kn: "ಕನ್ನಡ", hi: "हिन्दी" };
const LANG_NAME: Record<Exclude<Lang, "auto">, string> = { en: "English", kn: "Kannada", hi: "Hindi" };
/** BCP 47 tags for the browser's speech recognition and speech synthesis. */
export const SPEECH_TAG: Record<Exclude<Lang, "auto">, string> = { en: "en-IN", kn: "kn-IN", hi: "hi-IN" };

export const isLang = (v: unknown): v is Lang =>
  typeof v === "string" && (LANGS as readonly string[]).includes(v);

/** The sentence added to the system prompt ("" for auto). */
export const languageLine = (lang: Lang): string =>
  lang === "auto"
    ? ""
    : `LANGUAGE: the visitor chose ${LANG_NAME[lang]}. Write every answer in ${LANG_NAME[lang]}. Project names, technology names, numbers and dates stay exactly as they are, and the facts must be identical to the English answer.`;
