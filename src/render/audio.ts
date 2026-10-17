import { transitions } from '../arsenal/transitions.ts';
import type { AudioSettings, Edl } from '../edl/schema.ts';
import { sourceToOutput, type Timeline } from '../edl/timeline.ts';
import { transitionDuration } from './cuts.ts';

const DENOISE: Record<AudioSettings['denoise'], string | null> = {
  off: null,
  // redução leve: tira o chiado de fundo sem deixar a voz "embaixo d'água"
  light: 'afftdn=nr=8:nf=-45:tn=1',
  medium: 'afftdn=nr=14:nf=-40:tn=1',
};

/**
 * Tratamento da voz, antes da normalização: corta grave inútil, reduz ruído,
 * doma sibilância e nivela a dinâmica com compressão suave.
 */
export function voiceChain(settings: AudioSettings): string[] {
  const chain = ['highpass=f=70'];
  const denoise = DENOISE[settings.denoise];
  if (denoise) chain.push(denoise, ...compensate(LATENCY_MS.afftdn));
  if (settings.deesser) chain.push('deesser=i=0.35:m=0.5:f=0.5:s=o');
  chain.push('acompressor=threshold=-21dB:ratio=2.5:attack=8:release=140:knee=4:makeup=1');
  return chain;
}

/**
 * Atraso que cada filtro introduz, medido com um impulso a 48 kHz. Sem compensar, o áudio sai
 * ~30 ms depois da imagem: os fades deixam de coincidir com os cortes e a legenda adianta.
 */
export const LATENCY_MS = { afftdn: 25, limiterAttack: 5 } as const;

/** Descarta o começo atrasado para o áudio voltar a alinhar com o vídeo. */
export function compensate(latencyMs: number): string[] {
  return latencyMs > 0 ? [`atrim=start=${(latencyMs / 1000).toFixed(4)}`, 'asetpts=PTS-STARTPTS'] : [];
}

/**
 * Normalização em ganho linear + limitador. O `loudnorm` em passe único (ou quando não
 * consegue manter o modo linear) age como compressor lento e faz a fala "bombear";
 * medir e aplicar um ganho fixo é previsível e transparente.
 */
export function normalizeChain(measuredLufs: number, settings: AudioSettings): string[] {
  return [gainFilter(measuredLufs, settings), limiterFilter(settings)];
}

export function gainFilter(measuredLufs: number, settings: AudioSettings): string {
  const gain = Math.max(-20, Math.min(20, settings.targetLufs - measuredLufs));
  return `volume=${gain.toFixed(2)}dB`;
}

export function limiterFilter(settings: AudioSettings): string {
  // o alimiter trabalha em pico de amostra; 0.5 dB de folga cobre o pico real entre amostras
  const limit = 10 ** ((settings.truePeakDb - 0.5) / 20);
  return [
    `alimiter=limit=${limit.toFixed(4)}:attack=${LATENCY_MS.limiterAttack}:release=60:level=false`,
    // o lookahead do limitador atrasa o sinal pelo tempo de ataque; o apad repõe o fim descartado
    ...compensate(LATENCY_MS.limiterAttack),
    'apad',
  ].join(',');
}

export interface SfxCue {
  file: string;
  /** segundos do vídeo final */
  at: number;
  gainDb: number;
}

export interface MusicBed {
  file: string;
  gainDb: number;
  duck: boolean;
  fadeIn: number;
  fadeOut: number;
}

export interface MixOptions {
  /** rótulo da voz já tratada e normalizada, ex.: "[voice]" */
  voice: string;
  /** índice da entrada do ffmpeg para a música e para cada SFX */
  musicInput: number | null;
  music: MusicBed | null;
  sfxInputs: number[];
  sfx: SfxCue[];
  durationSec: number;
  limiter: string;
  rate: number;
  /** rótulo de saída; padrão "[aout]" */
  output?: string;
}

/**
 * Mixagem final: voz + música (com ducking por sidechain: a música abaixa sozinha quando há fala)
 * + efeitos posicionados no tempo. Devolve as linhas do filtergraph que terminam em [aout].
 */
export function buildMixGraph(options: MixOptions): string[] {
  const lines: string[] = [];
  const stereo = `aresample=${options.rate},aformat=channel_layouts=stereo`;
  const inputs: string[] = [];
  const hasMusic = options.music !== null && options.musicInput !== null;

  if (hasMusic) {
    const music = options.music!;
    const fadeOutStart = Math.max(0, options.durationSec - music.fadeOut);
    const bed = [
      stereo,
      `atrim=0:${options.durationSec.toFixed(3)}`,
      `volume=${music.gainDb.toFixed(1)}dB`,
      ...(music.fadeIn > 0 ? [`afade=t=in:st=0:d=${music.fadeIn}`] : []),
      ...(music.fadeOut > 0 ? [`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${music.fadeOut}`] : []),
    ].join(',');
    if (music.duck) {
      lines.push(
        `${options.voice}asplit=2[voxmain][voxkey]`,
        `[${options.musicInput}:a]${bed}[bed]`,
        // ataque rápido para a música sair da frente da primeira sílaba; soltura lenta para não "respirar"
        '[bed][voxkey]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450:knee=4[music]',
      );
      inputs.push('[voxmain]', '[music]');
    } else {
      lines.push(`[${options.musicInput}:a]${bed}[music]`);
      inputs.push(options.voice, '[music]');
    }
  } else {
    inputs.push(options.voice);
  }

  options.sfx.forEach((cue, index) => {
    const delay = Math.max(0, Math.round(cue.at * 1000));
    lines.push(`[${options.sfxInputs[index]}:a]${stereo},volume=${cue.gainDb.toFixed(1)}dB,adelay=${delay}:all=1[sfx${index}]`);
    inputs.push(`[sfx${index}]`);
  });

  // o atrim fecha o apad do limitador exatamente na duração do vídeo
  const tail = `${options.limiter},atrim=0:${options.durationSec.toFixed(3)},aresample=${options.rate}${options.output ?? '[aout]'}`;
  if (inputs.length === 1) lines.push(`${inputs[0]}${tail}`);
  // normalize=0: o amix não pode reduzir a voz ao somar faixas; duration=first: a voz manda na duração
  else lines.push(`${inputs.join('')}amix=inputs=${inputs.length}:normalize=0:duration=first:dropout_transition=0,${tail}`);
  return lines;
}

/** SFX padrão da biblioteca (assets/sfx/<nome>.wav). */
export const SFX = { whoosh: 'whoosh.wav', pop: 'pop.wav', click: 'click.wav', ding: 'ding.wav', glitch: 'glitch.wav' } as const;

/** arquivo da biblioteca para o tipo de som que o preset de transição pede */
const TRANSITION_SFX: Record<'whoosh' | 'pop' | 'glitch', string> = { whoosh: SFX.whoosh, pop: SFX.pop, glitch: SFX.glitch };

/** componentes cuja entrada ganha um "pop" discreto */
const POP_COMPONENTS = new Set(['LowerThird', 'BulletList', 'Counter', 'BarChart', 'Callout', 'MemeInsert', 'SubscribeCTA']);

/**
 * Efeitos sincronizados: os explícitos da EDL + whoosh em transição e pop em entrada de gráfico.
 * STYLE.md §10: nunca dois SFX no mesmo segundo — o primeiro fica.
 */
export function collectSfx(edl: Edl, timeline: Timeline, resolve: (file: string) => string | null): SfxCue[] {
  const cues: (SfxCue & { explicit: boolean })[] = [];
  const add = (file: string | null, at: number | null, gainDb: number, explicit = false) => {
    if (!file || at === null) return;
    const path = resolve(file);
    if (path) cues.push({ file: path, at: Math.max(0, at), gainDb, explicit });
  };
  for (const cue of edl.sfx) add(cue.file, sourceToOutput(timeline, cue.at), cue.gainDb, true);
  for (const transition of edl.transitions) {
    const clip = timeline.clips.find((item) => item.id === transition.intoClip);
    // o whoosh começa antes do corte e atravessa a transição
    const preset = transitions[transition.type];
    add(preset?.sfx ? TRANSITION_SFX[preset.sfx] : null, clip ? clip.outputStart - transitionDuration(transition) / 2 : null, -14);
  }
  for (const overlay of edl.overlays) {
    if (POP_COMPONENTS.has(overlay.component)) add(SFX.pop, sourceToOutput(timeline, overlay.at), -18);
  }
  // os pedidos na EDL têm prioridade sobre os automáticos
  cues.sort((a, b) => Number(b.explicit) - Number(a.explicit) || a.at - b.at);
  const kept: SfxCue[] = [];
  for (const { explicit, ...cue } of cues) {
    if (explicit || kept.every((other) => Math.abs(other.at - cue.at) >= 1)) kept.push(cue);
  }
  return kept.sort((a, b) => a.at - b.at);
}
