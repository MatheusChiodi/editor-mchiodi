export interface Word {
  text: string;
  start: number;
  end: number;
  score: number;
  segment: number;
  interpolated: boolean;
}

export interface Transcript {
  meta: {
    model: string;
    device: string;
    computeType: string;
    language: string;
    aligned: boolean;
    durationSec: number;
    elapsedSec: number;
    fallback: string | null;
  };
  segments: { id: number; start: number; end: number; text: string }[];
  words: Word[];
}

export interface Span {
  start: number;
  end: number;
}

export interface Phrase extends Span {
  id: string;
  /** índices [from, to) em transcript.words */
  from: number;
  to: number;
  text: string;
  pauseAfter: number;
}

export type FlagKind = 'retake' | 'restart' | 'marker' | 'filler' | 'voiced-gap';

/** Trecho que a análise sugere cortar. É proposta: o diretor pode recusar. */
export interface Flag extends Span {
  kind: FlagKind;
  reason: string;
  confidence: number;
}

export interface MediaInfo {
  path: string;
  durationSec: number;
  fps: number;
  width: number;
  height: number;
  videoCodec: string;
  isVfr: boolean;
  audioRate: number;
  audioChannels: number;
  hasAudio: boolean;
}

export interface Loudness {
  integratedLufs: number;
  truePeakDb: number;
  lra: number;
  threshold: number;
}

export interface Analysis {
  source: MediaInfo;
  /** arquivo usado no render final (o original, ou o intermediário CFR se a fonte era VFR) */
  renderSource: string;
  proxy: string;
  loudness: Loudness;
  silences: Span[];
  scenes: number[];
  phrases: Phrase[];
  flags: Flag[];
  createdAt: string;
}
