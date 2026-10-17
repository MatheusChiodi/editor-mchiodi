import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../anim';
import { BACKDROP, useStage } from '../arsenal/StageLayer';
import {
  anchorOpacity,
  contentTiming,
  exitCue,
  holePath,
  normalizePushes,
  noteColumn,
  type PresenterSlot,
  pushAt,
  type PushSpec,
  sameStage,
  screenSpan,
  stageMotion,
  WINDOW,
  windowBodyRect,
  windowRect,
  windowSide,
} from '../arsenal/stage';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';
import { type ClickRing, type FocusBox, FocusLayer, validBoxes, validClicks } from './ScreenFocus';
import { cue, cueTimes, NotePill, PILL_MIN_FONT, type PillTone, pillTilt, resolveTone, rise } from './stage-kit';

export type WindowLineTone = 'prompt' | 'output' | 'ok' | 'dim' | 'accent';
export type WindowKind = 'terminal' | 'screen' | 'footage';

export interface WindowLine {
  text: string;
  tone?: WindowLineTone;
  /** segundos, relativos ao início do overlay, em que a linha aparece */
  at?: number;
}

export interface WindowNote {
  text: string;
  tone?: PillTone;
  at?: number;
}

export interface WindowStageProps {
  /** título na barra da janela */
  title?: string;
  /**
   * `terminal`: linhas desenhadas aqui; `screen`: o corpo mostra a gravação de tela separada (`layout.screen`);
   * `footage`: o próprio vídeo principal (que já é a tela gravada) vai inteiro para dentro da janela
   */
  kind?: WindowKind;
  lines?: WindowLine[];
  /** pílulas que anotam, ao lado da janela, o que acontece nela */
  notes?: WindowNote[];
  /** zoom no conteúdo da janela, ancorado num ponto dela (0–1); um ou vários ao longo do overlay, nos três `kind` */
  push?: PushSpec | PushSpec[];
  /** destaque: escurece o entorno de um retângulo do conteúdo (0–1) e desenha um contorno coral */
  focus?: FocusBox[];
  /** anel de clique em pontos do conteúdo (0–1) */
  clicks?: ClickRing[];
  /** janela à direita e pílulas à esquerda, quando não há palco (no palco o lado vem do `presenter.slot`) */
  mirror?: boolean;
}

export const MAX_LINES = 9;
export const MAX_NOTES = 4;
export const LINE_START = 0.9;
export const LINE_STEP = 0.8;
export const TYPE_SEC = 0.7;
/** segundos que a tampa escura leva para abrir sobre a gravação de tela */
export const LID_SEC = 0.3;

const LINE_STYLE: Record<WindowLineTone, { color: string; prefix: string }> = {
  prompt: { color: theme.color.white, prefix: '❯ ' },
  output: { color: theme.color.slate300, prefix: '' },
  ok: { color: theme.color.emerald, prefix: '✓ ' },
  dim: { color: theme.color.slate600, prefix: '' },
  accent: { color: theme.color.coral, prefix: '' },
};

export const lineTone = (tone: unknown): WindowLineTone => (typeof tone === 'string' && tone in LINE_STYLE ? (tone as WindowLineTone) : 'output');

export const windowKind = (kind: unknown): WindowKind => (kind === 'screen' || kind === 'footage' ? kind : 'terminal');

/** Quantos caracteres de uma linha digitada já apareceram: o prompt é digitado, o resto surge inteiro. */
export function typedLength(text: string, tone: WindowLineTone, secSinceCue: number): number {
  if (secSinceCue < 0) return 0;
  if (tone !== 'prompt') return text.length;
  return Math.min(text.length, Math.ceil((secSinceCue / TYPE_SEC) * text.length));
}

/** Com o apresentador num canto, a coluna ao lado da janela é mais curta: cabem 3 pílulas em vez de 4. */
export function noteLimit(slot: PresenterSlot | null | undefined): number {
  return slot && slot.startsWith('pip-') ? 3 : MAX_NOTES;
}

/** Opacidade da tampa escura sobre a gravação de tela: fechada até `openAt`, abre em `LID_SEC` e fecha 5 f antes de `closeAt`. */
export function lidOpacity(sec: number, span: { openAt: number; closeAt: number }, keepIn: boolean, keepOut: boolean): number {
  const opening = keepIn ? 0 : 1 - Math.min(1, Math.max(0, (sec - span.openAt) / LID_SEC));
  const closing = keepOut ? 0 : Math.min(1, Math.max(0, (sec - (span.closeAt - 5 / 30)) / (5 / 30)));
  return Math.max(opening, closing);
}

/**
 * Janela flutuante sobre papel: terminal desenhado aqui, a gravação de tela dentro dela, ou o próprio footage
 * (quando o vídeo já é a tela gravada), com pílulas anotando ao lado, zoom no que é citado, destaque e anel de
 * clique. O apresentador fica num cartão no canto (`presenter: { "slot": "pip-br" }`); com `pip-bl`/`pip-tl` a
 * janela espelha para a direita.
 */
export const WindowStage: React.FC<WindowStageProps & BaseProps> = ({ title = 'Terminal', kind: rawKind = 'terminal', lines = [], notes = [], push, focus, clicks, mirror = false, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const sec = frame / fps;
  const total = durationInFrames / fps;
  const kind = windowKind(rawKind);
  const media = kind !== 'terminal';
  const stage = useStage();
  const plan = stage?.plan ?? null;
  const side = windowSide(plan?.slot, mirror);
  const rect = windowRect(side, media);
  const body = windowBodyRect(side, media);
  const box = { left: rect.x * width, top: rect.y * height, width: rect.w * width, height: rect.h * height };
  const bodyBox = { left: body.x * width, top: body.y * height, width: body.w * width, height: body.h * height };
  const bar = WINDOW.bar * height;
  const unit = height / 1080;
  const self = { component: 'WindowStage', kind };
  // a mesma janela colada antes ou depois: a moldura fica, só o conteúdo troca
  const keepIn = Boolean(plan && sameStage(plan.from, { ...self, slot: plan.slot }));
  const keepOut = Boolean(plan?.next && sameStage(plan.next, { ...self, slot: plan.slot }));

  const shownLines = lines.slice(0, MAX_LINES);
  const lineTimes = cueTimes(shownLines.map((line) => line.at), LINE_START, LINE_STEP);
  const shownNotes = notes.slice(0, noteLimit(plan?.slot));
  const noteTimes = cueTimes(shownNotes.map((note) => note.at), LINE_START + 0.6, 1.8);
  const timing = contentTiming(plan, total, 1 + shownNotes.length);
  // o footage dentro da janela é movido pelo ffmpeg com os pushes do palco; nos outros casos a conta é a mesma, feita aqui
  const pushes = kind === 'footage' && plan?.pushes ? plan.pushes : normalizePushes(push, total);
  const state = pushAt(pushes, sec);

  const arrive = keepIn ? 1 : rise(frame, fps, timing.startSec, stageMotion.window.sec);
  // a moldura é o último item a sair; as pílulas saem antes, a mais nova primeiro
  const depart = keepOut ? 0 : exitCue(sec, timing.exitSec, shownNotes.length);
  const span = screenSpan(plan, total, self);
  const lid = kind === 'screen' ? lidOpacity(sec, span, keepIn, keepOut) : 0;
  const column = noteColumn(side, plan?.slot);
  const radius = WINDOW.radius * unit;

  return (
    <AbsoluteFill>
      {/* papel e moldura levam o recorte do palco quando o footage está dentro da janela; destaques e pílulas ficam por cima */}
      <AbsoluteFill style={{ clipPath: stage?.clip }}>
      <AbsoluteFill
        style={{
          background: BACKDROP.paper,
          // com tela gravada o papel tem um buraco no corpo da janela; com o footage num palco, o buraco é o do próprio palco
          clipPath: kind === 'screen' || (kind === 'footage' && !plan) ? `path(evenodd, "${holePath(width, height, [{ rect: body, radius, radii: [0, 0, radius, radius] }])}")` : undefined,
        }}
      />
      <div
        style={{
          position: 'absolute',
          ...box,
          borderRadius: radius,
          overflow: 'hidden',
          // sombra longa medida da janela, tingida de slate
          boxShadow: `0 ${30 * unit}px ${90 * unit}px rgba(15,23,42,0.30), 0 0 0 1px rgba(15,23,42,0.10)`,
          opacity: anchorOpacity(Math.min(1, arrive * 2), depart, timing),
          // com tela ou footage a janela não se move: o buraco do papel é fixo
          translate: media ? undefined : `0 ${(1 - arrive) * stageMotion.window.rise * unit}px`,
          scale: media ? undefined : String((stageMotion.window.scaleFrom + (1 - stageMotion.window.scaleFrom) * arrive) * (1 - 0.06 * depart)),
        }}
      >
        <div style={{ height: bar, background: '#1c1c22', display: 'flex', alignItems: 'center', gap: 12 * unit, padding: `0 ${22 * unit}px`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)' }}>
          {[theme.color.coral, theme.color.glowPeach, theme.color.emerald].map((color) => (
            <div key={color} style={{ width: 16, height: 16, borderRadius: theme.radius.pill, background: color }} />
          ))}
          <div style={{ marginLeft: 14, fontFamily: theme.font.mono, fontWeight: 500, fontSize: 28, color: theme.color.slate300 }}>{title}</div>
        </div>
        <div style={{ position: 'relative', height: box.height - bar, overflow: 'hidden', background: media ? `rgba(12,12,12,${lid})` : theme.color.night }}>
          {media ? null : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: '34px 40px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                // o zoom acontece dentro da janela (que recorta a sobra): ela nunca invade as pílulas
                transform: `translate(${state.tx * box.width}px, ${state.ty * (box.height - bar)}px) scale(${state.scale})`,
                transformOrigin: '0 0',
              }}
            >
              {shownLines.map((line, index) => {
                const tone = lineTone(line.tone);
                const since = sec - lineTimes[index]!;
                const text = line.text.slice(0, typedLength(line.text, tone, since));
                const typing = tone === 'prompt' && since >= 0 && since < TYPE_SEC + 0.3;
                return (
                  <div
                    key={index}
                    style={{
                      fontFamily: theme.font.mono,
                      fontWeight: tone === 'prompt' ? 700 : 500,
                      fontSize: 34,
                      lineHeight: 1.3,
                      color: LINE_STYLE[tone].color,
                      opacity: cue(frame, fps, lineTimes[index]!, 0.25),
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <span style={{ color: tone === 'prompt' ? theme.color.coral : undefined }}>{LINE_STYLE[tone].prefix}</span>
                    {text}
                    {typing ? <span style={{ color: theme.color.coral }}>▍</span> : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, opacity: (1 - lid) * (1 - depart) }}>
        <FocusLayer {...bodyBox} state={state} boxes={validBoxes(focus)} clicks={validClicks(clicks)} sec={sec} totalSec={total} radius={radius} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: column.x * width,
          width: column.w * width,
          top: column.y * height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 18,
        }}
      >
        {shownNotes.map((note, index) => {
          const gone = exitCue(sec, timing.exitSec, shownNotes.length - 1 - index);
          return (
            <div key={index} style={{ opacity: 1 - gone, translate: `0 ${-gone * 12}px` }}>
              <NotePill
                text={note.text}
                tone={resolveTone(note.tone, index % 2 === 0 ? 'paper' : 'coral')}
                fontSize={PILL_MIN_FONT}
                compact
                tilt={pillTilt(index, 'side')}
                maxWidth={column.w * width}
                progress={rise(frame, fps, noteTimes[index]!)}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: WindowStage,
  opaque: true,
  sample: {
    title: 'Claude Code',
    kind: 'terminal',
    lines: [
      { text: 'cria um mod que mostra minhas estatísticas', tone: 'prompt', at: 0.9 },
      { text: 'Claro. Vou mudar a sua interface com um mod.', at: 2.2 },
      { text: 'Write ~/.claude/mods/estatisticas/mod.ts', tone: 'dim', at: 3 },
      { text: 'Painel adicionado à sua interface', tone: 'ok', at: 4 },
    ],
    notes: [
      { text: 'em linguagem natural', at: 1.4 },
      { text: 'feito pra você', tone: 'coral', at: 4.2 },
    ],
    push: [{ at: 4.3, scale: 1.3, x: 0.15, y: 0.3 }],
    focus: [{ at: 5.6, duration: 2.4, x: 0.03, y: 0.265, w: 0.6, h: 0.075 }],
    clicks: [{ at: 6.4, x: 0.05, y: 0.3 }],
  },
  defaultDuration: 9,
  vertical: { zone: 'skip' },
  description:
    'Janela flutuante sobre papel com terminal digitado (`kind: "terminal"`), a gravação de tela separada (`"screen"`, de `layout.screen`) ou o próprio footage quando o vídeo já é a tela gravada (`"footage"`), com pílulas anotando ao lado, zoom ancorado no que é citado (`push`, um ou vários), destaque com contorno coral (`focus`) e anel de clique (`clicks`). O apresentador fica num cartão no canto (use `presenter: { "slot": "pip-br" }` no overlay; `pip-bl` espelha a janela). Padrão obrigatório do nível max.',
};
