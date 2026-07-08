// Helpers for the Web Speech API (browser dictation) used by the assistant composer.
// Kept as pure functions so the failure-handling logic is testable and reviewable
// in isolation from the mic/audio side effects.

// Minimal shapes of the Web Speech API bits we actually read. The DOM lib types for
// SpeechRecognition are inconsistent across browsers, so we model only what we use.
export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

/**
 * Returns the browser's SpeechRecognition constructor (standard or webkit-prefixed),
 * or null when unavailable — unsupported browser (e.g. Firefox) or server-side render.
 */
export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechErrorInfo {
  /** User-facing message to toast, or null when the error is benign and should pass silently. */
  toastMessage: string | null;
  level: "error" | "warning";
}

/**
 * Maps a SpeechRecognitionErrorEvent `error` code to user-facing guidance.
 * Benign codes — the user simply stopped (`aborted`) or said nothing (`no-speech`) —
 * pass silently so we don't nag during normal use.
 */
export function describeSpeechError(code: string | undefined): SpeechErrorInfo {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return {
        toastMessage: "Microphone blocked — allow mic access to use voice.",
        level: "error",
      };
    case "audio-capture":
      return { toastMessage: "No microphone found — check your device.", level: "error" };
    case "network":
      return { toastMessage: "Voice input needs an internet connection.", level: "error" };
    case "no-speech":
    case "aborted":
      return { toastMessage: null, level: "warning" };
    default:
      return { toastMessage: "Voice input error — please try again.", level: "warning" };
  }
}
