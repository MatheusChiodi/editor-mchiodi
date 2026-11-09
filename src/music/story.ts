import type { CameraId, MoodId, PoseId, PropId, SettingId, Shot, TimeId, TransitionId, WeatherId } from '../../motion/src/music/types.ts';
import type { LyricLine } from './lyrics.ts';
import { motifForText, type MotifMatch, type PlannedScene } from './scenes.ts';
import type { EnergyLevel, Section } from './sections.ts';

/**
 * Diretor de história: transforma letra, seções e batidas numa sequência de planos com arco narrativo, em ritmo de
 * montagem de cinema (planos curtos, cortes nas batidas, mais rápidos nos trechos fortes), alternando o personagem no
 * cenário com ilustrações do que a letra diz.
 */
export interface StoryInput {
  lyrics: LyricLine[];
  sections: Section[];
  durationSec: number;
  /** batidas e tempos fortes, em segundos; vazios = corta pelo ritmo-alvo */
  beats: number[];
  downbeats: number[];
}

/** Duração-alvo de cada plano por energia da seção (s), e o piso. */
const TARGET: Record<EnergyLevel, number> = { low: 4.2, mid: 3.3, high: 2.5 };
const MIN_SHOT = 1.6;

type Act = 'intro' | 'setup' | 'conflict' | 'climax' | 'memory' | 'outro';

/** Arco: abertura, apresentação, conflito, clímax, memória e desfecho, pela posição na música. */
export const actAt = (progress: number): Act => (progress < 0.07 ? 'intro' : progress < 0.28 ? 'setup' : progress < 0.5 ? 'conflict' : progress < 0.74 ? 'climax' : progress < 0.9 ? 'memory' : 'outro');

interface ActLook {
  settings: SettingId[];
  time: TimeId;
  weather: (energy: EnergyLevel) => WeatherId;
  poses: PoseId[];
  moods: MoodId[];
  cameras: CameraId[];
}

const LOOK: Record<Act, ActLook> = {
  intro: { settings: ['window'], time: 'night', weather: () => 'rain', poses: ['stand'], moods: ['sad'], cameras: ['push'] },
  setup: { settings: ['bedroom'], time: 'night', weather: () => 'clear', poses: ['sit', 'lookDown', 'typing', 'phone'], moods: ['sad', 'neutral', 'sad'], cameras: ['push', 'panR', 'pull'] },
  conflict: { settings: ['street'], time: 'night', weather: (e) => (e === 'low' ? 'clear' : 'rain'), poses: ['walk', 'lookDown', 'phone', 'stand'], moods: ['sad', 'sad', 'cry'], cameras: ['panL', 'panR', 'tilt', 'push'] },
  climax: { settings: ['rooftop', 'rooftop', 'street'], time: 'night', weather: () => 'rain', poses: ['lookUp', 'faceHands', 'reach', 'back', 'stand'], moods: ['cry', 'angry', 'cry'], cameras: ['push', 'orbit'] },
  memory: { settings: ['park', 'park', 'bedroom'], time: 'dusk', weather: (e) => (e === 'high' ? 'clear' : 'fog'), poses: ['sit', 'reach', 'lookDown', 'phone'], moods: ['sad', 'sad', 'neutral'], cameras: ['pull', 'panL', 'still'] },
  outro: { settings: ['hills', 'hills', 'shore'], time: 'dawn', weather: () => 'clear', poses: ['walk', 'lookUp', 'stand', 'walk'], moods: ['hopeful', 'hopeful', 'smile'], cameras: ['pull', 'panR', 'tilt'] },
};

const nearest = (list: number[], target: number, tolerance: number): number | null => {
  let best: number | null = null;
  for (const value of list) if (Math.abs(value - target) <= tolerance && (best === null || Math.abs(value - target) < Math.abs(best - target))) best = value;
  return best;
};

/** Cortes: por seção (a fronteira da seção é sempre um corte), cada trecho picotado no ritmo da energia, nas batidas. */
function cutPoints(input: StoryInput): number[] {
  const { sections, durationSec, beats, downbeats } = input;
  const spans = sections.length ? sections : [{ start: 0, end: durationSec, energy: 'mid' as const, mean: 0.5 }];
  const cuts = [0];
  spans.forEach((span, spanIndex) => {
    const a = spanIndex === 0 ? 0 : span.start;
    const b = spanIndex === spans.length - 1 ? durationSec : span.end;
    if (spanIndex > 0 && a - cuts.at(-1)! >= MIN_SHOT) cuts.push(a);
    let t = Math.max(a, cuts.at(-1)!);
    while (b - t > TARGET[span.energy] * 1.5) {
      const target = t + TARGET[span.energy];
      const snapped = nearest(downbeats, target, 0.9) ?? nearest(beats, target, 0.5) ?? target;
      const next = Math.min(Math.max(snapped, t + MIN_SHOT), b - MIN_SHOT);
      cuts.push(next);
      t = next;
    }
  });
  cuts.push(durationSec);
  return cuts.map((cut) => Math.round(cut * 1000) / 1000);
}

/** Preferência de cenário de uma palavra-chave, só vale se o ato permite esse lugar. */
const KEYWORD_SETTING: Partial<Record<MotifMatch['motif'], SettingId>> = { phone: 'bedroom', photos: 'bedroom', clock: 'bedroom', paper: 'bedroom', road: 'street', shout: 'rooftop', night: 'rooftop', morning: 'hills' };

function applyKeyword(look: { shot: Shot }, match: MotifMatch | null, act: Act): void {
  if (!match) return;
  const shot = look.shot;
  const allowed = LOOK[act].settings;
  const preferred = KEYWORD_SETTING[match.motif];
  if (preferred && allowed.includes(preferred)) shot.setting = preferred;
  switch (match.motif) {
    case 'phone':
      shot.pose = shot.setting === 'street' ? 'phone' : 'typing';
      shot.props = ['phone'];
      break;
    case 'photos':
      shot.pose = 'lookDown';
      shot.props = ['photo'];
      break;
    case 'clock':
      shot.pose = 'lookDown';
      break;
    case 'road':
      shot.pose = 'walk';
      break;
    case 'rain':
      shot.weather = 'rain';
      shot.pose = act === 'setup' ? 'lookDown' : 'faceHands';
      if (act !== 'setup') shot.mood = 'cry';
      break;
    case 'paper':
      shot.pose = 'faceHands';
      break;
    case 'heart':
      shot.pose = shot.setting === 'rooftop' ? 'lookUp' : 'faceHands';
      break;
    case 'shout':
      shot.pose = 'lookUp';
      if (act === 'climax') shot.mood = 'angry';
      break;
    case 'night':
      shot.pose = 'back';
      break;
    case 'morning':
      shot.pose = 'lookUp';
      if (shot.setting === 'hills') shot.mood = 'hopeful';
      break;
  }
}

export function planStory(input: StoryInput): PlannedScene[] {
  const { durationSec, sections } = input;
  const energyAt = (t: number): EnergyLevel => (sections.find((section) => t >= section.start && t < section.end) ?? sections.at(-1))?.energy ?? 'mid';
  const lines = [...input.lyrics].sort((a, b) => a.start - b.start);
  const cuts = cutPoints(input);

  const scenes: PlannedScene[] = [];
  const countInAct: Partial<Record<Act, number>> = {};
  const camera: Record<string, number> = {};
  let storyCount = 0;

  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i]!;
    const end = cuts[i + 1]!;
    const mid = (start + end) / 2;
    const act = actAt(mid / durationSec);
    const energy = energyAt(mid);

    // verso que mais se sobrepõe ao plano
    let line: LyricLine | null = null;
    let overlap = 0;
    for (const candidate of lines) {
      const o = Math.min(end, candidate.end) - Math.max(start, candidate.start);
      if (o > overlap) {
        overlap = o;
        line = candidate;
      }
    }
    const match = line ? motifForText(line.text) : null;
    const previous = scenes.at(-1);

    // ilustração do que a letra diz, intercalada entre os planos (nunca duas seguidas)
    if (match && previous?.motif === 'story' && i % 2 === 1 && end - start >= MIN_SHOT) {
      const key = `insert-${match.motif}`;
      const n = (camera[key] = (camera[key] ?? 0) + 1);
      scenes.push({ start, end, motif: match.motif, keyword: match.keyword, variant: (n - 1) % 3, camera: n % 2 ? 'push' : 'pull' });
      continue;
    }

    const look = LOOK[act];
    const k = countInAct[act] ?? 0;
    countInAct[act] = k + 1;
    const pose = look.poses[k % look.poses.length]!;
    const holder = {
      shot: {
        setting: look.settings[k % look.settings.length]!,
        time: look.time,
        weather: look.weather(energy),
        pose,
        mood: look.moods[k % look.moods.length]!,
        props: (pose === 'phone' || pose === 'typing' ? ['phone'] : act === 'memory' && pose === 'lookDown' ? ['photo'] : []) as PropId[],
      } satisfies Shot,
    };
    if (act === 'conflict' && pose === 'walk' && holder.shot.weather === 'rain' && k % 2 === 0) holder.shot.props = ['umbrella'];
    applyKeyword(holder, match, act);
    storyCount++;
    scenes.push({ start, end, motif: 'story', keyword: match?.keyword ?? null, variant: (storyCount - 1) % 3, shot: holder.shot, camera: look.cameras[k % look.cameras.length]! });
  }

  // desfecho: o último plano de história é sempre o amanhecer nas colinas, com sorriso
  const lastStory = [...scenes].reverse().find((scene) => scene.motif === 'story');
  if (lastStory?.shot && actAt(((lastStory.start + lastStory.end) / 2) / durationSec) === 'outro') {
    lastStory.shot = { ...lastStory.shot, setting: 'hills', time: 'dawn', weather: 'clear', mood: 'smile', pose: lastStory.shot.pose === 'back' ? 'walk' : lastStory.shot.pose, props: [] };
  }

  // transições: seção nova = cortina; ilustração = zoom; mudou de lugar = whip; tempo forte em trecho forte = flash/glitch
  const sectionStarts = new Set(sections.slice(1).map((section) => Math.round(section.start * 1000) / 1000));
  let punch = 0;
  scenes.forEach((scene, i) => {
    if (i === 0) {
      scene.transition = 'fade';
      return;
    }
    const before = scenes[i - 1]!;
    const onDownbeat = input.downbeats.some((d) => Math.abs(d - scene.start) < 0.05);
    let transition: TransitionId = 'fade';
    if (sectionStarts.has(scene.start)) transition = 'wipe';
    else if (scene.motif !== 'story' || before.motif !== 'story') transition = 'zoom';
    else if (before.shot && scene.shot && before.shot.setting !== scene.shot.setting) transition = 'whip';
    else if (energyAt(scene.start) === 'high') transition = onDownbeat ? (punch++ % 2 ? 'glitch' : 'flash') : i % 3 === 0 ? 'cut' : 'fade';
    scene.transition = transition;
  });

  scenes[0]!.start = 0;
  scenes.at(-1)!.end = durationSec;
  return scenes;
}
