export type SpeechPhase = "idle" | "starting" | "listening" | "transcribing";

/** Called only when the user submits reviewed, nonempty text. Throw to retain it for retry. */
export type TranscriptReadyHandler = (transcript: string) => void | Promise<void>;

export interface SpeechPanelProps {
  onTranscriptReady?: TranscriptReadyHandler;
  /** One fresh spoken utterance, delivered after capture returns to idle. */
  onSpeechReady?: TranscriptReadyHandler;
  onPhaseChange?: (phase: SpeechPhase) => void;
  /** Shell sets this during engine execution or approval. Typing and copying remain available. */
  disabled?: boolean;
  language?: string;
  /** Synchronous pure formatting hook for decoded continuous speech; no analytics. */
  formatTranscript?: (transcript: string) => string;
}

export interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
export interface RecognitionEvent {
  readonly results: ArrayLike<RecognitionResult>;
}
export interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionConstructor = new () => Recognition;
