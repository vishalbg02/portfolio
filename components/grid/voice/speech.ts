import { SPEECH_TAG, type Lang } from "@/lib/ai/lang";

/**
 * Helpers for the browser's own speech features (Web Speech API). Nothing here talks to a server: dictation and spoken
 * replies are done by the visitor's browser. Both are feature-detected and simply absent where unsupported.
 */
export type RecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

export function recognitionCtor(w: Window = window): RecognitionCtor | null {
  const g = w as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}
export const canSpeak = (w: Window = window) => "speechSynthesis" in w && "SpeechSynthesisUtterance" in w;

/** The language tag to listen and speak in: the chosen one, or (for auto) the browser's if it is one we cover. */
export function speechTag(lang: Lang, browserLanguage: string = navigator.language): string {
  if (lang !== "auto") return SPEECH_TAG[lang];
  const base = browserLanguage.toLowerCase().slice(0, 2);
  return base === "kn" ? SPEECH_TAG.kn : base === "hi" ? SPEECH_TAG.hi : SPEECH_TAG.en;
}

/**
 * What gets read out loud: the answer without citation markers, bold marks, bullets or URLs, which sound like noise.
 * (The text on screen is unchanged: captions are always shown.)
 */
export function speakableText(text: string): string {
  return text
    .replace(/\[\d{1,2}\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\bhttps?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A voice for the tag, if the device has one (Kannada voices are common on Android, rare elsewhere). */
export function voiceFor(tag: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const base = tag.slice(0, 2).toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null
  );
}
