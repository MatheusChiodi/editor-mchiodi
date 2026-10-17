import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, Counter, enter, Eyebrow, IconBadge, pillShadow, popIn, rise, SceneBackground, SceneCard, text } from '../../scene-kit';
import { theme } from '../../theme';
import { Glyph, GlyphBadge, type GlyphName } from './kit-b';

export interface ArtigoReconhecidoReveal {
  /** "publicar meus artigos": entra o cartão do artigo */
  article: number;
  /** o botão é apertado e vira "Publicado" */
  publish: number;
  /** "as pessoas realmente iam ver": os contadores começam a subir */
  views: number;
  /** "ser reconhecido": entra o selo */
  recognized: number;
}

export interface ArticleStats {
  views: number;
  likes: number;
  comments: number;
}

export interface ArtigoReconhecidoProps {
  /** segundos relativos ao início da cena */
  revealAt?: ArtigoReconhecidoReveal;
  eyebrow?: string;
  author?: string;
  articleTitle?: string;
  /** valores finais dos contadores */
  stats?: ArticleStats;
  /** frase do selo */
  recognition?: string;
}

const DEFAULT_REVEAL: ArtigoReconhecidoReveal = { article: 0.4, publish: 2.2, views: 3.8, recognized: 6.0 };
const DEFAULT_STATS: ArticleStats = { views: 1248, likes: 312, comments: 47 };
const STAT_ROWS: { key: keyof ArticleStats; glyph: GlyphName; label: string }[] = [
  { key: 'views', glyph: 'eye', label: 'leituras' },
  { key: 'likes', glyph: 'heart', label: 'curtidas' },
  { key: 'comments', glyph: 'chat', label: 'comentários' },
];
/** largura (0–1) de cada linha de texto simulada no corpo do artigo */
export const BODY_LINES = [1, 0.94, 0.62];
const PRESS_SEC = 0.3;
const SEAL = 124;
const SEAL_GAP = 44;

export interface PublishPhase {
  /** 0→1→0: o botão afunda e volta */
  press: number;
  /** 0→1: "Publicar" dá lugar a "Publicado" */
  swap: number;
  published: boolean;
}

/** Estado do botão no instante `sec`: aperta em `publishAt`, e no meio do aperto troca para "Publicado". */
export function publishPhase(sec: number, publishAt: number): PublishPhase {
  const elapsed = sec - publishAt;
  const half = PRESS_SEC / 2;
  const press = elapsed <= 0 || elapsed >= PRESS_SEC ? 0 : 1 - Math.abs(elapsed - half) / half;
  const swap = Math.max(0, Math.min(1, (elapsed - half) / PRESS_SEC));
  return { press, swap, published: elapsed >= half };
}

/** Quando cada linha do corpo do artigo se escreve: distribuídas entre a entrada do cartão e o clique em publicar. */
export function bodyLineTimes(articleAt: number, publishAt: number, count = BODY_LINES.length): number[] {
  const from = articleAt + 0.5;
  const to = Math.max(from, publishAt - 0.5);
  const step = count > 1 ? (to - from) / (count - 1) : 0;
  return Array.from({ length: count }, (_, index) => from + Math.min(step, 0.45) * index);
}

/** Janela de contagem de cada contador: entram escalonados e todos terminam um pouco antes do selo. */
export function statSchedule(viewsAt: number, recognizedAt: number, count = STAT_ROWS.length, staggerSec = 0.25): { atSec: number; durationSec: number }[] {
  const end = Math.max(viewsAt + 1, recognizedAt - 0.2);
  return Array.from({ length: count }, (_, index) => {
    const atSec = viewsAt + index * staggerSec;
    return { atSec, durationSec: Math.max(0.6, end - atSec) };
  });
}

export interface ArticleLayout {
  width: number;
  height: number;
  card: { width: number; height: number };
  stat: { width: number; height: number; gap: number };
  gap: number;
}

/** Cartão do artigo à esquerda e os três contadores empilhados à direita, com a mesma altura total. */
export function articleLayout(count = STAT_ROWS.length): ArticleLayout {
  const cardWidth = 880;
  const statWidth = 520;
  const gap = 64;
  const statGap = 28;
  const statHeight = 164;
  const height = statHeight * count + statGap * (count - 1);
  return {
    width: cardWidth + gap + statWidth,
    height,
    card: { width: cardWidth, height },
    stat: { width: statWidth, height: statHeight, gap: statGap },
    gap,
  };
}

const buttonBase: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  borderRadius: theme.radius.pill,
  fontFamily: theme.font.body,
  fontWeight: 600,
  fontSize: text.label,
  boxShadow: pillShadow,
};

const statusBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 24px',
  borderRadius: theme.radius.pill,
  fontFamily: theme.font.body,
  fontWeight: 500,
  fontSize: 34,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
  color: theme.color.slate900,
};

/** Publicar um artigo na comunidade, ser lido e ser reconhecido pelo que estudou. */
export const ArtigoReconhecido: React.FC<ArtigoReconhecidoProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  eyebrow = 'Artigos da comunidade',
  author = 'Matheus Chiodi',
  articleTitle = 'O que eu aprendi estudando back-end',
  stats = DEFAULT_STATS,
  recognition = 'Reconhecido pelo que eu estudei.',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = articleLayout();
  const card = enter(frame, fps, revealAt.article, 0.5);
  const phase = publishPhase(frame / fps, revealAt.publish);
  const lines = bodyLineTimes(revealAt.article, revealAt.publish);
  const schedule = statSchedule(revealAt.views, revealAt.recognized);
  const seal = enter(frame, fps, revealAt.recognized, 0.45);
  const sealPop = popIn(frame, fps, revealAt.recognized, 0.5);
  // até o selo entrar, artigo e contadores ficam no centro da área útil; depois sobem e abrem espaço para ele
  const lift = (1 - enter(frame, fps, revealAt.recognized - 0.4, 0.7)) * ((SEAL + SEAL_GAP) / 2);

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Eyebrow progress={enter(frame, fps, 0)} style={{ translate: `0px ${lift.toFixed(2)}px` }}>
        {eyebrow}
      </Eyebrow>

      <div style={{ display: 'flex', gap: layout.gap, width: layout.width, height: layout.height, marginTop: 40, translate: `0px ${lift.toFixed(2)}px` }}>
        <SceneCard
          progress={card}
          padding={44}
          style={{ width: layout.card.width, height: layout.card.height, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <IconBadge icon="user" variant="ink" size={80} progress={enter(frame, fps, revealAt.article + 0.1, 0.5)} />
            <div style={{ flex: 1, fontFamily: theme.font.body, fontWeight: 600, fontSize: text.label, color: theme.color.slate900 }}>{author}</div>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  ...statusBase,
                  background: alpha(theme.color.emerald, 0.14),
                  border: `2px solid ${alpha(theme.color.emerald, 0.6)}`,
                  opacity: phase.swap,
                }}
              >
                <span style={{ width: 13, height: 13, borderRadius: theme.radius.pill, background: theme.color.emerald }} />
                publicado
              </div>
              <div
                style={{
                  ...statusBase,
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  background: alpha(theme.color.white, 0.75),
                  border: `2px solid ${alpha(theme.color.slate300, 0.8)}`,
                  color: theme.color.slate600,
                  opacity: 1 - phase.swap,
                }}
              >
                rascunho
              </div>
            </div>
          </div>

          <div
            style={{
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: 54,
              lineHeight: 1.14,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
              ...rise(enter(frame, fps, revealAt.article + 0.25), 20),
            }}
          >
            {articleTitle}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {BODY_LINES.map((width, index) => {
              const written = enter(frame, fps, lines[index] ?? 0, 0.5);
              return (
                <div
                  key={index}
                  style={{ width: `${width * written * 100}%`, height: 16, borderRadius: theme.radius.pill, background: theme.color.slate300, opacity: written > 0 ? 1 : 0 }}
                />
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', ...rise(enter(frame, fps, revealAt.article + 0.5), 16) }}>
            <div style={{ position: 'relative', width: 320, height: 82, scale: String(1 - 0.06 * phase.press) }}>
              <div style={{ ...buttonBase, background: theme.color.slate900, color: theme.color.white, opacity: 1 - phase.swap }}>Publicar</div>
              <div style={{ ...buttonBase, background: theme.color.emerald, color: theme.color.slate900, opacity: phase.swap }}>
                <Glyph name="check" size={40} strokeWidth={2.4} draw={phase.swap} />
                Publicado
              </div>
            </div>
          </div>
        </SceneCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: layout.stat.gap, width: layout.stat.width }}>
          {STAT_ROWS.map((row, index) => {
            const slot = schedule[index] ?? { atSec: revealAt.views, durationSec: 1 };
            const progress = enter(frame, fps, slot.atSec, 0.45);
            return (
              <SceneCard
                key={row.key}
                progress={progress}
                padding="0 36px"
                style={{ width: layout.stat.width, height: layout.stat.height, display: 'flex', alignItems: 'center', gap: 28 }}
              >
                <GlyphBadge glyph={row.glyph} size={96} progress={enter(frame, fps, slot.atSec + 0.08, 0.5)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Counter to={stats[row.key]} atSec={slot.atSec} durationSec={slot.durationSec} fontSize={64} />
                  <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: text.eyebrow, lineHeight: 1.2, color: theme.color.slate600 }}>{row.label}</div>
                </div>
              </SceneCard>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 32, height: SEAL, marginTop: SEAL_GAP, opacity: seal }}>
        <GlyphBadge glyph="award" variant="coral" size={SEAL} progress={seal} style={{ scale: String(0.7 + 0.3 * sealPop) }} />
        <div
          style={{
            fontFamily: theme.font.display,
            fontWeight: 600,
            fontSize: 68,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            color: theme.color.slate900,
            ...rise(enter(frame, fps, revealAt.recognized + 0.15), 20),
          }}
        >
          {recognition}
        </div>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: ArtigoReconhecido,
  sample: { revealAt: DEFAULT_REVEAL, stats: DEFAULT_STATS },
  defaultDuration: 8,
  description:
    'Cena papel: um artigo sendo publicado na comunidade (botão "Publicar" vira "Publicado"), contadores de leituras, curtidas e comentários subindo e, por fim, o selo de reconhecimento.',
};

export const MODEL = 'CartaoComContadoresESelo';
