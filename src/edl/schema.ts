import { z } from 'zod';

import { CAPTION_PRESETS } from '../../motion/src/captions/presets.ts';
import { effects } from '../arsenal/effects.ts';
import { transitions } from '../arsenal/transitions.ts';
import { DEFAULT_LEVEL, LEVEL_IDS } from './levels.ts';

const TRANSITION_IDS = Object.keys(transitions) as [string, ...string[]];
const EFFECT_IDS = Object.keys(effects) as [string, ...string[]];

/**
 * Regra única de tempo: todo instante na EDL é em segundos do ARQUIVO FONTE.
 * O renderer converte para tempo de saída. Assim, mexer nos cortes nunca
 * dessincroniza legendas, overlays, zooms ou capítulos.
 */
const seconds = z.number().nonnegative();
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'use kebab-case');

export const removalKindSchema = z.enum(['silence', 'retake', 'filler', 'marker', 'manual']);

export const clipSchema = z
  .object({
    id,
    start: seconds,
    end: seconds,
    /** trecho falado, para o relatório e para o diretor se localizar */
    quote: z.string().default(''),
    reason: z.string().default(''),
  })
  .refine((clip) => clip.end > clip.start, { message: 'end precisa ser maior que start' });

export const removalSchema = z.object({
  start: seconds,
  end: seconds,
  kind: removalKindSchema,
  reason: z.string().default(''),
});

export const captionsSchema = z.object({
  enabled: z.boolean().default(true),
  /** formato (posição e tamanho base): `long` 16:9, `shorts` 9:16 */
  style: z.enum(['long', 'shorts']).default('long'),
  /** estilo visual (`pnpm mce arsenal captions`); `padrao` é o de sempre */
  preset: z.enum(CAPTION_PRESETS).default('padrao'),
  maxWordsPerPage: z.number().int().min(1).max(12).default(5),
  /** palavras que recebem destaque (comparação sem acento/caixa) */
  highlights: z.array(z.string()).default([]),
  /** correções de grafia: palavra transcrita -> palavra exibida */
  replacements: z.record(z.string(), z.string()).default({}),
});

export const overlaySchema = z.object({
  id,
  /** componente da biblioteca (`LowerThird`) ou cena sob medida (`scene:<projeto>/<Nome>`) */
  component: z.string().regex(/^([A-Z][A-Za-z0-9]*|scene:[a-z0-9-]+\/[A-Z][A-Za-z0-9]*)$/, 'use "Nome" ou "scene:<projeto>/<Nome>"'),
  at: seconds,
  duration: z.number().positive(),
  props: z.record(z.string(), z.unknown()).default({}),
  /** por que essa animação existe — vai para o relatório */
  reason: z.string().default(''),
  /** as legendas se escondem enquanto o overlay ocupa a faixa inferior */
  hidesCaptions: z.boolean().default(false),
  /**
   * Palco: durante o overlay o footage encolhe para um cartão (o apresentador) e o resto do quadro vira papel,
   * onde o componente desenha. O cartão e o reenquadramento são animados juntos (STYLE.md §0).
   */
  presenter: z
    .object({
      /** `window`/`window-right`: o footage inteiro vai para dentro da janela do `WindowStage` (o vídeo já é a tela gravada) */
      slot: z.enum(['right', 'left', 'pip-br', 'pip-bl', 'pip-tr', 'pip-tl', 'window', 'window-right']),
      /** onde está o rosto no footage (0–1) */
      focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: 0.5, y: 0.4 }),
      /** aproximação do rosto dentro do cartão; sem valor, a padrão do slot */
      zoom: z.number().min(1).max(3).optional(),
      /** fundo atrás do componente; `none` para componente que já pinta o quadro inteiro */
      backdrop: z.enum(['paper', 'night', 'none']).default('paper'),
      /** duração (s) da troca de layout deste palco; sem valor, a medida na referência (0,9 s) */
      transitionSec: z.number().min(0.2).max(2).optional(),
    })
    .nullable()
    .default(null),
  /** `tear`: o overlay (cena de tela cheia) entra por um rasgo de papel, da esquerda para a direita */
  wipe: z.enum(['none', 'tear']).default('none'),
  /** `persistent`: camada fixa que atravessa vários layouts (indicador de progresso) e convive com o gráfico da vez */
  layer: z.enum(['base', 'persistent']).default('base'),
});

export const zoomSchema = z.object({
  id,
  at: seconds,
  duration: z.number().positive(),
  scale: z.number().min(1).max(1.6).default(1.12),
  /** ponto de foco normalizado (0-1) */
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: 0.5, y: 0.4 }),
  mode: z.enum(['punch', 'ease', 'ken-burns']).default('ease'),
  reason: z.string().default(''),
});

export const transitionSchema = z.object({
  id,
  /** a transição acontece na entrada deste clipe */
  intoClip: id,
  /** id do catálogo de transições (`pnpm mce arsenal transitions`) */
  type: z.enum(TRANSITION_IDS),
  /** segundos; sem valor, usa a duração padrão do preset */
  duration: z.number().positive().max(1.5).optional(),
  reason: z.string().default(''),
});

export const effectSchema = z.object({
  id,
  /** id do catálogo de efeitos (`pnpm mce arsenal effects`) */
  preset: z.enum(EFFECT_IDS),
  at: seconds,
  /** segundos; sem valor, usa a duração padrão do preset (ou vai até o fim do vídeo, nos que valem para o vídeo todo) */
  duration: z.number().positive().optional(),
  /** 0–1; sem valor, usa a intensidade padrão do preset */
  intensity: z.number().min(0).max(1).optional(),
  /** ponto de interesse normalizado (zoom, holofote, desfoque) */
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: 0.5, y: 0.4 }),
  reason: z.string().default(''),
});

export const sfxSchema = z.object({
  id,
  file: z.string(),
  at: seconds,
  gainDb: z.number().default(-12),
});

export const musicSchema = z.object({
  file: z.string(),
  gainDb: z.number().default(-24),
  duck: z.boolean().default(true),
  fadeIn: z.number().nonnegative().default(1.5),
  fadeOut: z.number().nonnegative().default(3),
});

export const gradeSchema = z.object({
  preset: z.enum(['none', 'neutral', 'warm', 'cool', 'punchy']).default('neutral'),
  lut: z.string().nullable().default(null),
  exposure: z.number().min(-1).max(1).default(0),
  contrast: z.number().min(0.5).max(1.5).default(1),
  saturation: z.number().min(0).max(2).default(1),
  sharpen: z.number().min(0).max(1).default(0),
});

export const audioSchema = z.object({
  targetLufs: z.number().default(-14),
  truePeakDb: z.number().default(-1.5),
  /** `light`/`medium` = afftdn; `deepfilter` = DeepFilterNet em pré-passo (sem o binário, cai para `light`) */
  denoise: z.enum(['off', 'light', 'medium', 'deepfilter']).default('light'),
  deesser: z.boolean().default(true),
  /** fade em cada borda de corte, em ms */
  cutFadeMs: z.number().min(0).max(50).default(12),
});

export const chapterSchema = z.object({
  title: z.string().min(1),
  at: seconds,
});

/**
 * Respiro declarado: trecho que o diretor escolheu deixar sem edição (parte pessoal, tela que precisa ser vista inteira).
 * A avaliação não avisa `trecho-parado` nele; continua contando nos 20% e no teto de 40 s do nível max.
 */
export const breatherSchema = z
  .object({
    start: seconds,
    end: seconds,
    /** por que este trecho fica sem edição */
    reason: z.string().trim().min(1, 'diga por que este trecho fica sem edição'),
  })
  .refine((breather) => breather.end > breather.start, { message: 'end precisa ser maior que start' });

export const layoutSchema = z.object({
  /** gravação de tela em arquivo separado, sincronizada com a fonte */
  screen: z
    .object({
      path: z.string(),
      offsetSec: z.number().default(0),
    })
    .nullable()
    .default(null),
  segments: z
    .array(
      z.object({
        start: seconds,
        end: seconds,
        mode: z.enum(['camera', 'screen', 'pip', 'split']),
        pipCorner: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).default('bottom-right'),
      }),
    )
    .default([]),
});

export const shortsSchema = z
  .object({
    /** trecho da fonte que vira o Short (o melhor momento, escolhido pelo diretor) */
    start: seconds,
    end: seconds,
    /** onde está o rosto na horizontal (0–1), para o recorte 9:16 */
    focusX: z.number().min(0).max(1).default(0.5),
    reason: z.string().default(''),
  })
  .refine((shorts) => shorts.end > shorts.start, { message: 'end precisa ser maior que start' });

export const edlSchema = z
  .object({
    version: z.number().int().positive(),
    project: z.string(),
    createdAt: z.string(),
    /** o que mudou nesta versão e por quê */
    notes: z.string().default(''),
    /** nível de edição: quanto de gráfico, zoom, transição e efeito o vídeo leva (`pnpm mce levels`) */
    level: z.enum(LEVEL_IDS).default(DEFAULT_LEVEL),
    source: z.object({
      path: z.string(),
      durationSec: z.number().positive(),
      fps: z.number().positive(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    output: z.object({
      fps: z.number().positive(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    clips: z.array(clipSchema).min(1),
    removed: z.array(removalSchema).default([]),
    captions: captionsSchema.default(captionsSchema.parse({})),
    overlays: z.array(overlaySchema).default([]),
    zooms: z.array(zoomSchema).default([]),
    transitions: z.array(transitionSchema).default([]),
    effects: z.array(effectSchema).default([]),
    sfx: z.array(sfxSchema).default([]),
    music: musicSchema.nullable().default(null),
    grade: gradeSchema.default(gradeSchema.parse({})),
    audio: audioSchema.default(audioSchema.parse({})),
    layout: layoutSchema.default(layoutSchema.parse({})),
    chapters: z.array(chapterSchema).default([]),
    /** respiros escolhidos pelo diretor (tempos da fonte) */
    breathers: z.array(breatherSchema).default([]),
    shorts: shortsSchema.nullable().default(null),
    intro: z.boolean().default(false),
    outro: z.boolean().default(false),
  })
  .superRefine((edl, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });

    edl.clips.forEach((clip, index) => {
      if (clip.end > edl.source.durationSec + 0.05) {
        issue(['clips', index, 'end'], `passa do fim da fonte (${edl.source.durationSec}s)`);
      }
      const next = edl.clips[index + 1];
      // sem reordenação: o render em passe único depende de clipes em ordem crescente
      if (next && next.start < clip.end - 1e-6) {
        issue(['clips', index + 1, 'start'], `sobrepõe ou vem antes do clipe "${clip.id}"`);
      }
    });

    const ids = new Set<string>();
    const all = [...edl.clips, ...edl.overlays, ...edl.zooms, ...edl.transitions, ...edl.effects, ...edl.sfx];
    for (const item of all) {
      if (ids.has(item.id)) issue([], `id duplicado: "${item.id}"`);
      ids.add(item.id);
    }

    const inKeptClip = (time: number) => edl.clips.some((clip) => time >= clip.start - 1e-6 && time < clip.end);
    const anchored: [string, { id?: string; title?: string; at: number }[]][] = [
      ['overlays', edl.overlays],
      ['zooms', edl.zooms],
      ['effects', edl.effects],
      ['sfx', edl.sfx],
      ['chapters', edl.chapters],
    ];
    for (const [key, items] of anchored) {
      items.forEach((item, index) => {
        if (!inKeptClip(item.at)) {
          issue([key, index, 'at'], `${item.at}s cai num trecho cortado; ancore num instante que ficou no vídeo`);
        }
      });
    }

    const clipIds = new Set(edl.clips.map((clip) => clip.id));
    edl.transitions.forEach((transition, index) => {
      if (!clipIds.has(transition.intoClip)) {
        issue(['transitions', index, 'intoClip'], `clipe "${transition.intoClip}" não existe`);
      } else if (edl.clips[0]?.id === transition.intoClip) {
        issue(['transitions', index, 'intoClip'], 'não há corte antes do primeiro clipe');
      }
    });

    edl.breathers.forEach((breather, index) => {
      if (breather.end > edl.source.durationSec + 0.05) {
        issue(['breathers', index, 'end'], `passa do fim da fonte (${edl.source.durationSec}s)`);
      }
    });

    if (edl.chapters.length > 0 && edl.chapters.length < 3) {
      issue(['chapters'], 'o YouTube exige ao menos 3 capítulos');
    }
  });

export type Edl = z.infer<typeof edlSchema>;
export type EdlInput = z.input<typeof edlSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type Removal = z.infer<typeof removalSchema>;
export type Overlay = z.infer<typeof overlaySchema>;
export type Breather = z.infer<typeof breatherSchema>;
export type Zoom = z.infer<typeof zoomSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type Grade = z.infer<typeof gradeSchema>;
export type AudioSettings = z.infer<typeof audioSchema>;
export type CaptionSettings = z.infer<typeof captionsSchema>;

export function parseEdl(data: unknown): Edl {
  return edlSchema.parse(data);
}

export function formatEdlIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `- ${issue.path.join('.') || '(raiz)'}: ${issue.message}`).join('\n');
}
