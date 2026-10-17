// MODELO de animação reutilizável: na EDL entra como `scene:modelos/TrocaEntreDoisPolos`, em qualquer vídeo.
// Forma: dois polos nas pontas e duas setas curvas entre eles (a ida por cima, a volta por baixo), cada uma com seu rótulo;
// depois o diagrama sobe e dá lugar à frase de fecho.

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { Arrow, enter, Eyebrow, IconBadge, type IconName, Pill, type Point, rise, SceneBackground, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';
import { CHAR, CLIP, type Extent, fitFont, fitPill, iconOr, lineCount, MIN_TEXT, pillClamp, timeOr, titleSize } from './kit-a';

export interface TrocaPole {
  label: string;
  icon?: IconName;
}

export interface TrocaReveal {
  /** a seta de ida (da esquerda para a direita) */
  go?: number;
  /** a seta de volta */
  back?: number;
  /** a frase de fecho */
  closing?: number;
}

export interface TrocaEntreDoisPolosProps {
  eyebrow?: string;
  /** o polo da esquerda: de onde a troca parte */
  left?: TrocaPole;
  /** o polo da direita */
  right?: TrocaPole;
  /** o que vai (rótulo da seta de cima) */
  goLabel?: string;
  /** o que volta (rótulo da seta de baixo) */
  backLabel?: string;
  /** frase de fecho, embaixo do diagrama (omitida = o diagrama fica no centro até o fim) */
  title?: string;
  /** trecho da frase em coral: o único acento da tela */
  accent?: string;
  /** linha de apoio embaixo da frase */
  support?: string;
  /** segundos relativos ao início da cena, por parte */
  revealAt?: TrocaReveal;
}

const DEFAULT_REVEAL = { go: 0.9, back: 1.75, closing: 4.0 };
const DEFAULT_LEFT: TrocaPole = { label: 'Um lado', icon: 'user' };
const DEFAULT_RIGHT: TrocaPole = { label: 'O outro', icon: 'user' };
const BLOCK_GAP = 52;
const TITLE_SIZE = 88;
const LABEL_WIDTH = 400;

export interface TrocaLayout {
  width: number;
  height: number;
  badge: number;
  left: Point;
  right: Point;
  go: { from: Point; to: Point; bend: number; label: Point };
  back: { from: Point; to: Point; bend: number; label: Point };
  /** y do nome de cada polo, embaixo do disco */
  labelY: number;
  /** largura livre entre os dois discos, para os rótulos das setas */
  between: number;
}

/** Um polo em cada ponta e duas setas curvas entre eles: ida por cima, volta por baixo. */
export function trocaLayout(width = 1320): TrocaLayout {
  const badge = 176;
  const centerY = badge / 2 + 40;
  const bend = 44;
  const inset = badge + 36;
  const offset = 46;
  const middle = width / 2;
  return {
    width,
    height: centerY + badge / 2 + 76,
    badge,
    left: [badge / 2, centerY],
    right: [width - badge / 2, centerY],
    // `bend` negativo nas duas: indo para a direita curva para cima; voltando para a esquerda, para baixo
    go: { from: [inset, centerY - offset], to: [width - inset, centerY - offset], bend: -bend, label: [middle, centerY - offset - bend] },
    back: { from: [width - inset, centerY + offset], to: [inset, centerY + offset], bend: -bend, label: [middle, centerY + offset + bend] },
    labelY: centerY + badge / 2 + 24,
    between: width - inset * 2,
  };
}

/** Tempos das partes fixas, com o padrão no que faltar. */
export function trocaReveal(revealAt: TrocaReveal = {}): Required<TrocaReveal> {
  return {
    go: timeOr(revealAt.go, DEFAULT_REVEAL.go),
    back: timeOr(revealAt.back, DEFAULT_REVEAL.back),
    closing: timeOr(revealAt.closing, DEFAULT_REVEAL.closing),
  };
}

/** Altura (px) do bloco da frase de fecho: título em uma ou duas linhas, mais o apoio. Sem título, 0. */
export function trocaClosingHeight(title: string | undefined, support?: string, maxWidth = 1500): number {
  if (!title) return 0;
  const size = titleSize(title, TITLE_SIZE, maxWidth);
  const titleLines = Math.min(2, lineCount(title, maxWidth, size, CHAR.display));
  const supportLines = support ? Math.min(2, lineCount(support, maxWidth * 0.8, text.body)) : 0;
  return Math.round(titleLines * size * 1.12 + (supportLines ? size * 0.3 + supportLines * text.body * 1.4 : 0));
}

/** Quanto o diagrama desce para ficar no centro enquanto a frase de fecho não entrou (px). */
export function trocaLift(closingProgress: number, closingHeight: number): number {
  return closingHeight > 0 ? ((1 - closingProgress) * (closingHeight + BLOCK_GAP)) / 2 : 0;
}

const Pole: React.FC<{ pole: TrocaPole; center: Point; size: number; labelY: number; progress: number }> = ({ pole, center, size, labelY, progress }) => (
  <>
    <IconBadge icon={iconOr(pole.icon, 'user')!} size={size} progress={progress} style={{ position: 'absolute', left: center[0] - size / 2, top: center[1] - size / 2 }} />
    <div
      style={{
        position: 'absolute',
        left: center[0] - LABEL_WIDTH / 2,
        width: LABEL_WIDTH,
        top: labelY,
        textAlign: 'center',
        fontFamily: theme.font.body,
        fontWeight: 600,
        fontSize: fitFont(pole.label, LABEL_WIDTH, text.label, MIN_TEXT, CHAR.bold),
        lineHeight: 1.2,
        color: theme.color.slate900,
        ...CLIP,
        ...rise(progress, 16),
      }}
    >
      {pole.label}
    </div>
  </>
);

const Label: React.FC<{ at: Point; progress: number; room: number; children: string }> = ({ at, progress, room, children }) => (
  <div style={{ position: 'absolute', left: at[0], top: at[1], width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {/* fundo opaco: a pílula interrompe a seta em vez de deixar o traço passar por trás do texto */}
    <Pill fontSize={fitPill(children, room)} progress={progress} style={{ background: theme.color.paper, ...pillClamp(room) }}>
      <span style={CLIP}>{children}</span>
    </Pill>
  </div>
);

export const TrocaEntreDoisPolos: React.FC<TrocaEntreDoisPolosProps & BaseProps> = ({
  eyebrow,
  left = DEFAULT_LEFT,
  right = DEFAULT_RIGHT,
  goLabel = 'vai',
  backLabel = 'volta',
  title,
  accent,
  support,
  revealAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = trocaLayout();
  const reveal = trocaReveal(revealAt);
  const go = enter(frame, fps, reveal.go, 0.6);
  const back = enter(frame, fps, reveal.back, 0.6);
  // até a frase de fecho entrar, o diagrama fica no centro da área útil; depois sobe e abre espaço para ela
  const lift = trocaLift(enter(frame, fps, reveal.closing - 0.35, 0.7), trocaClosingHeight(title, support));
  const labelRoom = layout.between - 120;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: BLOCK_GAP }}>
      {eyebrow ? (
        <Eyebrow progress={enter(frame, fps, 0)} style={{ translate: `0px ${lift.toFixed(2)}px` }}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      <div style={{ position: 'relative', width: layout.width, height: layout.height, translate: `0px ${lift.toFixed(2)}px` }}>
        <Arrow from={layout.go.from} to={layout.go.to} bend={layout.go.bend} progress={go} />
        <Arrow from={layout.back.from} to={layout.back.to} bend={layout.back.bend} progress={back} />
        <Pole pole={left} center={layout.left} size={layout.badge} labelY={layout.labelY} progress={enter(frame, fps, 0.15, 0.5)} />
        <Pole pole={right} center={layout.right} size={layout.badge} labelY={layout.labelY} progress={enter(frame, fps, 0.3, 0.5)} />
        <Label at={layout.go.label} progress={enter(frame, fps, reveal.go + 0.2)} room={labelRoom}>
          {goLabel}
        </Label>
        <Label at={layout.back.label} progress={enter(frame, fps, reveal.back + 0.2)} room={labelRoom}>
          {backLabel}
        </Label>
      </div>
      {/* a frase ocupa o lugar desde o início (invisível) para o diagrama não pular quando ela entra */}
      {title ? (
        <div style={{ opacity: frame >= reveal.closing * fps ? 1 : 0 }}>
          <Statement text={title} accent={accent} support={support} atSec={reveal.closing} fontSize={titleSize(title, TITLE_SIZE)} />
        </div>
      ) : null}
    </SceneBackground>
  );
};

/** Caixa ocupada pela cena com estas props (eyebrow + diagrama + frase de fecho), para conferir contra a área útil sem renderizar. */
export function trocaExtent(props: TrocaEntreDoisPolosProps = {}): Extent {
  const layout = trocaLayout();
  const closing = trocaClosingHeight(props.title, props.support);
  return {
    // o nome de cada polo é mais largo que o disco e sobra para fora do diagrama
    width: layout.width + LABEL_WIDTH - layout.badge,
    height: Math.round((props.eyebrow ? MIN_TEXT * 1.2 + BLOCK_GAP : 0) + layout.height + (closing ? BLOCK_GAP + closing : 0)),
  };
}

export const entry: ComponentEntry = {
  component: TrocaEntreDoisPolos,
  sample: {
    eyebrow: 'Code review',
    left: { label: 'Quem escreve', icon: 'code' },
    right: { label: 'Quem revisa', icon: 'eye' },
    goLabel: 'manda o pull request',
    backLabel: 'devolve os comentários',
    title: 'E o código melhora no caminho.',
    accent: 'melhora',
    support: 'Cada ida e volta deixa o código um pouco mais claro.',
    revealAt: { go: 0.9, back: 1.8, closing: 4.0 },
  },
  defaultDuration: 7.5,
  description:
    'Para a fala sobre duas partes que trocam algo, ida e volta ("um manda, o outro responde"): dois polos nas pontas, a seta de ida por cima ' +
    'e a de volta por baixo, cada uma com o nome do que trafega; depois o diagrama sobe e entra a frase com a conclusão. ' +
    'Serve para cliente e servidor, pergunta e resposta, quem escreve e quem revisa, pedido e entrega.',
  tags: ['troca', 'ida-e-volta', 'fluxo', 'dois-lados', 'diagrama'],
  origin: { project: 'teste-fullstack', date: '2026-10-12', scene: 'teste-fullstack/EnviarReceber' },
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do diagrama' },
    { name: 'left', type: '{ label: string; icon?: IconName }', description: 'o polo da esquerda, de onde a troca parte' },
    { name: 'right', type: '{ label: string; icon?: IconName }', description: 'o polo da direita' },
    { name: 'goLabel', type: 'string', description: 'o que vai, na seta de cima (até ~30 letras)' },
    { name: 'backLabel', type: 'string', description: 'o que volta, na seta de baixo (até ~30 letras)' },
    { name: 'title', type: 'string?', description: 'frase de fecho, embaixo do diagrama; omitida = o diagrama fica no centro até o fim' },
    { name: 'accent', type: 'string?', description: 'trecho da frase em coral' },
    { name: 'support', type: 'string?', description: 'linha de apoio embaixo da frase' },
    { name: 'revealAt', type: '{ go?: number; back?: number; closing?: number }', description: 'segundo em que entra a seta de ida, a de volta e a frase de fecho' },
  ],
};
