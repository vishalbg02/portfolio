import { describe, expect, it } from "vitest";
import { LANGS, LANG_LABEL, SPEECH_TAG, isLang, languageLine } from "@/lib/ai/lang";
import { speakableText, speechTag, voiceFor } from "@/components/grid/voice/speech";

const voice = (lang: string, name = lang) => ({ lang, name }) as SpeechSynthesisVoice;

describe("voice helpers", () => {
  it("reads an answer without citation markers, bold marks, bullets or URLs", () => {
    expect(
      speakableText(
        "Vishal used **Spring Boot** [2][3] at Kaha.\n\n- Built REST APIs [1]\n- See https://x.io/a now",
      ),
    ).toBe("Vishal used Spring Boot at Kaha. Built REST APIs See now");
    expect(speakableText("   ")).toBe("");
  });

  it("listens and speaks in the chosen language; auto follows the browser if it is one we cover", () => {
    expect(speechTag("kn", "en-US")).toBe("kn-IN");
    expect(speechTag("hi", "en-US")).toBe("hi-IN");
    expect(speechTag("en", "kn-IN")).toBe("en-IN");
    expect(speechTag("auto", "kn-IN")).toBe("kn-IN");
    expect(speechTag("auto", "hi")).toBe("hi-IN");
    expect(speechTag("auto", "fr-FR")).toBe("en-IN");
  });

  it("picks an exact voice, else one for the same language, else none", () => {
    const voices = [voice("en-GB"), voice("hi-IN", "Hindi"), voice("en-IN", "India")];
    expect(voiceFor("en-IN", voices)?.name).toBe("India");
    expect(voiceFor("hi-IN", voices)?.name).toBe("Hindi");
    expect(voiceFor("en-AU", voices)?.lang).toBe("en-GB");
    expect(voiceFor("kn-IN", voices)).toBeNull();
  });
});

describe("reply language", () => {
  it("offers Auto, English, Kannada and Hindi, each with a label and (except auto) a speech tag", () => {
    expect([...LANGS]).toEqual(["auto", "en", "kn", "hi"]);
    for (const l of LANGS) expect(LANG_LABEL[l].length).toBeGreaterThan(0);
    expect(SPEECH_TAG).toEqual({ en: "en-IN", kn: "kn-IN", hi: "hi-IN" });
    expect(isLang("kn")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });

  it("adds a sentence to the prompt only for a chosen language, and keeps facts and names identical", () => {
    expect(languageLine("auto")).toBe("");
    const kn = languageLine("kn");
    expect(kn).toContain("Kannada");
    expect(kn).toMatch(/names, technology names, numbers and dates stay exactly as they are/);
  });

  it("flows through the request and into the model's instructions", async () => {
    const { validateChatRequest } = await import("@/lib/ai/guards");
    const ok = validateChatRequest({ messages: [{ role: "user", content: "hi" }], lang: "hi" });
    expect(ok.ok && ok.lang).toBe("hi");
    const junk = validateChatRequest({ messages: [{ role: "user", content: "hi" }], lang: "klingon" });
    expect(junk.ok && junk.lang).toBe("auto");
    const { agentInstructions } = await import("@/lib/ai/prompts");
    expect(agentInstructions([], { lang: "hi" })).toContain("14. LANGUAGE: the visitor chose Hindi");
    expect(agentInstructions([])).not.toContain("LANGUAGE:");
  });
});
