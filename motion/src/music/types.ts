/** Barras do espectro por quadro. */
export const MUSIC_BARS = 16;

/** Motivos visuais das cenas (o que a letra ilustra); `words`, `burst` e `blob` são os de reserva. */
export const MOTIF_IDS = ['story', 'phone', 'heart', 'night', 'morning', 'photos', 'clock', 'rain', 'road', 'shout', 'paper', 'words', 'burst', 'blob'] as const;
export type MotifId = (typeof MOTIF_IDS)[number];

export const SETTING_IDS = ['bedroom', 'street', 'rooftop', 'park', 'shore', 'hills', 'window'] as const;
export type SettingId = (typeof SETTING_IDS)[number];
export const POSE_IDS = ['stand', 'sit', 'walk', 'phone', 'typing', 'faceHands', 'lookUp', 'lookDown', 'reach', 'back'] as const;
export type PoseId = (typeof POSE_IDS)[number];
export const MOOD_IDS = ['neutral', 'sad', 'cry', 'hopeful', 'angry', 'smile'] as const;
export type MoodId = (typeof MOOD_IDS)[number];
export const TIME_IDS = ['night', 'dawn', 'day', 'dusk'] as const;
export type TimeId = (typeof TIME_IDS)[number];
export const WEATHER_IDS = ['clear', 'rain', 'fog'] as const;
export type WeatherId = (typeof WEATHER_IDS)[number];
export const CAMERA_IDS = ['push', 'pull', 'panL', 'panR', 'tilt', 'orbit', 'still'] as const;
export type CameraId = (typeof CAMERA_IDS)[number];
export const TRANSITION_IDS = ['cut', 'fade', 'flash', 'wipe', 'zoom', 'glitch', 'whip'] as const;
export type TransitionId = (typeof TRANSITION_IDS)[number];
export const PROP_IDS = ['phone', 'lamp', 'photo', 'umbrella', 'flower'] as const;
export type PropId = (typeof PROP_IDS)[number];

/** Plano de história: onde, quando, o que o personagem faz e sente. */
export interface Shot {
  setting: SettingId;
  time: TimeId;
  weather: WeatherId;
  pose: PoseId;
  mood: MoodId;
  props: PropId[];
}

export interface MusicScene {
  startFrame: number;
  endFrame: number;
  motif: MotifId;
  /** palavra em destaque do verso que chamou o motivo */
  keyword: string | null;
  /** 0–2: varia o visual quando o mesmo motivo volta */
  variant: number;
  /** só nas cenas `story`: o plano de história com o personagem */
  shot?: Shot;
  /** movimento de câmera e transição de entrada; sem valor, câmera parada e fade */
  camera?: CameraId;
  transition?: TransitionId;
}

export type MusicEnergy = 'low' | 'mid' | 'high';

export interface MusicSection {
  startFrame: number;
  endFrame: number;
  energy: MusicEnergy;
  /** fundo, destaque e brilho (hex) */
  palette: [string, string, string];
}

export interface MusicLyricWord {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface MusicLyricLine {
  text: string;
  startFrame: number;
  endFrame: number;
  words: MusicLyricWord[];
}

/**
 * Tudo que o Remotion precisa para desenhar o vídeo da música, já em quadros: nenhum cálculo de áudio acontece no
 * navegador, então o mesmo plano sempre gera o mesmo vídeo.
 */
export interface MusicPlan {
  title: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  bpm: number;
  /** quadros das batidas e dos tempos fortes */
  beats: number[];
  downbeats: number[];
  sections: MusicSection[];
  /** cenas ilustrativas, contíguas, cobrindo a música inteira */
  scenes: MusicScene[];
  /** 0–1 por quadro */
  bass: number[];
  mid: number[];
  treble: number[];
  rms: number[];
  /** `quadros × MUSIC_BARS`, 0–1 */
  bars: number[][];
  lyrics: MusicLyricLine[];
}
