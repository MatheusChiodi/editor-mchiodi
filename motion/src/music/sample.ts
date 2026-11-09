import { MUSIC_BARS, type MusicPlan } from './types';

const FPS = 30;
const FRAMES = FPS * 8;
const wave = (frame: number, hz: number, phase = 0) => 0.5 + 0.5 * Math.sin((2 * Math.PI * hz * frame) / FPS + phase);

/** Plano de exemplo para o Studio: 8 s a 120 BPM, com duas seções e dois versos. */
export const musicSamplePlan: MusicPlan = {
  title: 'Exemplo',
  fps: FPS,
  width: 1920,
  height: 1080,
  durationInFrames: FRAMES,
  bpm: 120,
  beats: Array.from({ length: 16 }, (_, i) => i * 15),
  downbeats: Array.from({ length: 4 }, (_, i) => i * 60),
  sections: [
    { startFrame: 0, endFrame: 120, energy: 'low', palette: ['#0b1020', '#7c93ff', '#9dffce'] },
    { startFrame: 120, endFrame: FRAMES, energy: 'high', palette: ['#1a0d12', '#ff5555', '#ffb86c'] },
  ],
  scenes: [
    { startFrame: 0, endFrame: 80, motif: 'night', keyword: null, variant: 0 },
    { startFrame: 80, endFrame: 160, motif: 'phone', keyword: 'mensagem', variant: 0 },
    { startFrame: 160, endFrame: FRAMES, motif: 'heart', keyword: null, variant: 0 },
  ],
  bass: Array.from({ length: FRAMES }, (_, f) => Math.exp(-(f % 15) / 6) * 0.9),
  mid: Array.from({ length: FRAMES }, (_, f) => wave(f, 0.5) * 0.7),
  treble: Array.from({ length: FRAMES }, (_, f) => wave(f, 1.3) * 0.5),
  rms: Array.from({ length: FRAMES }, (_, f) => (f < 120 ? 0.3 : 0.8)),
  bars: Array.from({ length: FRAMES }, (_, f) => Array.from({ length: MUSIC_BARS }, (_, i) => wave(f, 0.8 + i * 0.07, i) * (f < 120 ? 0.4 : 0.9))),
  lyrics: [
    { text: 'eu vou seguir', startFrame: 30, endFrame: 100, words: [{ text: 'eu', startFrame: 30, endFrame: 50 }, { text: 'vou', startFrame: 50, endFrame: 72 }, { text: 'seguir', startFrame: 72, endFrame: 100 }] },
    { text: 'sem olhar pra trás', startFrame: 140, endFrame: 215, words: [{ text: 'sem', startFrame: 140, endFrame: 158 }, { text: 'olhar', startFrame: 158, endFrame: 182 }, { text: 'pra', startFrame: 182, endFrame: 198 }, { text: 'trás', startFrame: 198, endFrame: 215 }] },
  ],
};
