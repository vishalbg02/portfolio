"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/ai/lang";
import { track } from "@/lib/analytics";
import { canSpeak, recognitionCtor, speakableText, speechTag, voiceFor, type Recognition } from "./speech";

/**
 * Push-to-talk dictation and optional spoken replies. Nothing starts by itself: dictation begins when the visitor presses
 * the microphone, and replies are only spoken after they turn the speaker on (that is per visit: it is never remembered,
 * so audio can't start on a later visit without them asking). Captions are always on screen: dictation fills the same text
 * box you can edit, and a spoken reply is the same text that is shown.
 */
const noSubscription = () => () => {};
/** Bit 1: dictation is possible, bit 2: speaking is. The server (and the first client render) see neither. */
const supportBits = () => (recognitionCtor() ? 1 : 0) | (canSpeak() ? 2 : 0);
const noSupport = () => 0;

export function useVoice(lang: Lang, onTranscript: (text: string) => void) {
  const bits = useSyncExternalStore(noSubscription, supportBits, noSupport);
  const support = { listen: (bits & 1) === 1, speak: (bits & 2) === 2 };
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [note, setNote] = useState("");
  const rec = useRef<Recognition | null>(null);
  const voices = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!canSpeak()) return;
    const load = () => (voices.current = window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
      rec.current?.abort();
    };
  }, []);

  const stopListening = useCallback(() => rec.current?.stop(), []);

  const startListening = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    window.speechSynthesis?.cancel(); // never listen over our own voice
    setSpeaking(false);
    setNote("");
    const r = new Ctor();
    r.lang = speechTag(lang);
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i]![0]!.transcript;
      onTranscript(text);
    };
    r.onerror = (e) =>
      setNote(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access was blocked. You can still type."
          : e.error === "no-speech"
            ? "I didn't hear anything. Try again."
            : e.error === "language-not-supported"
              ? "This browser can't listen in that language. You can still type."
              : "Dictation stopped. You can still type.",
      );
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
      track("grid_voice", { mode: "listen" });
    } catch {
      setListening(false);
    }
  }, [lang, onTranscript]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!canSpeak() || !speakOn) return;
      const clean = speakableText(text);
      if (!clean) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      const tag = speechTag(lang);
      u.lang = tag;
      const voice = voiceFor(tag, voices.current);
      if (voice) u.voice = voice;
      else if (!tag.startsWith("en"))
        setNote("No spoken voice for this language on this device. The reply is shown as text.");
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [lang, speakOn],
  );

  const toggleSpeak = useCallback(() => {
    setSpeakOn((on) => {
      if (on) {
        window.speechSynthesis?.cancel();
        setSpeaking(false);
      } else track("grid_voice", { mode: "speak" });
      return !on;
    });
  }, []);

  return {
    support,
    listening,
    speaking,
    speakOn,
    note,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleSpeak,
  };
}
