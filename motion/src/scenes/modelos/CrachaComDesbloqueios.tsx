// MODELO de animação reutilizável: na EDL entra como `scene:modelos/CrachaComDesbloqueios`, em qualquer vídeo.
// Forma: um crachá desce virando no centro (o título conquistado), desliza para a esquerda e, à direita,
// entra a frase e uma lista de itens que aparecem trancados e destravam um a um. 100% por props.

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, enter, Eyebrow, IconBadge, type IconName, longShadow, rise, SceneBackground, SceneCard, Statement } from '../../scene-kit';
import { theme } from '../../theme';
import { clampCount, estimateLines, estimateWidth, fillTimes, pickSec, roundSec } from './fit-b';

export interface CrachaComDesbloqueiosReveal {
  /** o crachá desce e vira */
  badge?: number;
  /** o crachá abre espaço e entra a frase */
  title?: number;
  /** segundo em que cada item aparece (trancado), por índice; destrava logo depois */
  items?: number[];
}

export interface CrachaComDesbloqueiosProps {
  /** linha pequena no topo do crachá: quem concede (programa, empresa, plano) */
  program?: string;
  /** o título conquistado, em destaque no crachá */
  role?: string;
  /** ícone no disco do crachá */
  icon?: IconName;
  title?: string;
  /** trecho do título em coral */
  accent?: string;
  /** de 1 a 6 itens que destravam, na ordem da fala */
  items?: string[];
  /** segundos relativos ao início da cena; o que faltar segue em sequência */
  revealAt?: CrachaComDesbloqueiosReveal;
}

export const ITEM_RANGE = { min: 1, max: 6 } as const;
/** segundos entre o item aparecer (trancado) e destravar */
export const UNLOCK_DELAY = 0.3;
const FLIP_SECONDS = 0.9;
const TITLE_FONT = 72;
const TITLE_GAP = 52;
const ROW = { height: 108, min: 76, font: 46, icon: 76, indent: 56 } as const;
const ROLE_WIDTH = 456;

const DEFAULT_ITEMS = ['Primeiro benefício', 'Segundo benefício', 'Terceiro benefício'];

export interface BadgeLayout {
  count: number;
  width: number;
  height: number;
  badge: { width: number; height: number; top: number; centerX: number; restX: number };
  column: { x: number; width: number; top: number; height: number };
  row: { height: number; gap: number; indent: number; fontSize: number; icon: number };
  /** largura estimada de cada linha, com o recuo em degraus */
  rowWidths: number[];
}

/** Largura estimada de uma linha de item: disco + texto + paddings do cartão. */
export function unlockRowWidth(label: string, fontSize: number, icon: number): number {
  return Math.ceil(18 + icon + 28 + estimateWidth(label, fontSize) + 44 + 4);
}

/** Crachá à esquerda (começa no centro e desliza) e, à direita, a frase com os itens em degraus. */
export function badgeLayout(labels: readonly string[] = DEFAULT_ITEMS, titleLines = 1, width = 1728, height = 836): BadgeLayout {
  const count = clampCount(labels.length, ITEM_RANGE.min, ITEM_RANGE.max);
  const badge = { width: 540, height: 620 };
  const restX = 70;
  const columnX = restX + badge.width + 110;
  const columnWidth = width - columnX;
  const gap = count <= 4 ? 22 : 16;
  const titleHeight = Math.ceil(titleLines * TITLE_FONT * 1.12);
  const free = height - 40 - titleHeight - TITLE_GAP - gap * (count - 1);
  const rowHeight = Math.max(ROW.min, Math.min(ROW.height, Math.floor(free / count)));
  const scale = rowHeight / ROW.height;
  const icon = Math.round(ROW.icon * scale);
  const shown = labels.slice(0, count);
  const widest = (fontSize: number) => Math.max(0, ...shown.map((label) => unlockRowWidth(label, fontSize, icon)));
  let fontSize = Math.max(34, Math.round(ROW.font * scale));
  while (fontSize > 34 && widest(fontSize) > columnWidth) fontSize -= 2;
  const indent = count > 1 ? Math.max(0, Math.min(ROW.indent, Math.floor((columnWidth - widest(fontSize)) / (count - 1)))) : 0;
  const columnHeight = titleHeight + TITLE_GAP + rowHeight * count + gap * (count - 1);
  return {
    count,
    width,
    height,
    badge: { ...badge, top: height - badge.height - 30, centerX: (width - badge.width) / 2, restX },
    column: { x: columnX, width: columnWidth, top: Math.max(0, Math.round((height - columnHeight) / 2)), height: columnHeight },
    row: { height: rowHeight, gap, indent, fontSize, icon },
    rowWidths: shown.map((label, index) => index * indent + unlockRowWidth(label, fontSize, icon)),
  };
}

/** x do crachá: no centro até a frase entrar, depois encosta à esquerda (`progress` 0→1). */
export function badgeX(layout: BadgeLayout, progress: number): number {
  return layout.badge.centerX + (layout.badge.restX - layout.badge.centerX) * progress;
}

/** Giro do crachá: entra de costas (180°) e termina de frente (0°); a frente só aparece depois dos 90°. */
export function badgeFlip(progress: number): { angle: number; front: boolean } {
  const angle = (1 - Math.max(0, Math.min(1, progress))) * 180;
  return { angle, front: angle < 90 };
}

export interface UnlockTimes {
  badge: number;
  title: number;
  /** quando cada linha entra, ainda com o cadeado */
  items: number[];
  /** quando o cadeado de cada linha vira o "check" verde */
  unlocks: number[];
}

/** Tempos da cena: crachá, frase e cada item (com o destrave `UNLOCK_DELAY` depois). */
export function unlockTimes(count: number, revealAt: CrachaComDesbloqueiosReveal = {}): UnlockTimes {
  const badge = pickSec(revealAt.badge, 0.5);
  const title = pickSec(revealAt.title, badge + 2.3);
  const items = fillTimes(clampCount(count, ITEM_RANGE.min, ITEM_RANGE.max), revealAt.items, title + 1.6, 0.7);
  return { badge, title, items, unlocks: items.map((at) => roundSec(at + UNLOCK_DELAY)) };
}

/** Tamanho do título do crachá: 58 px em até duas linhas; mais longo que isso, 46 px. */
export function roleFontSize(role: string, width = ROLE_WIDTH): number {
  return estimateLines(role, width, 58, 'display') <= 2 ? 58 : 46;
}

const Lanyard: React.FC<{ width: number }> = ({ width }) => (
  <svg
    width={width}
    height={900}
    viewBox={`0 0 ${width} 900`}
    style={{ position: 'absolute', left: 0, bottom: '100%', marginBottom: -52, overflow: 'visible' }}
    fill="none"
    stroke={theme.color.slate600}
    strokeWidth={5}
    strokeLinecap="round"
  >
    <path d={`M${width / 2 - 14} 870L${width / 2 - 150} 0M${width / 2 + 14} 870L${width / 2 + 150} 0`} />
    <rect x={width / 2 - 26} y={856} width={52} height={34} rx={10} fill={theme.color.white} stroke={theme.color.slate900} strokeWidth={4} />
  </svg>
);

const UnlockRow: React.FC<{ label: string; progress: number; unlock: number; indent: number; row: BadgeLayout['row'] }> = ({ label, progress, unlock, indent, row }) => (
  <SceneCard progress={progress} padding="0 44px 0 18px" style={{ marginLeft: indent, height: row.height, width: 'fit-content', display: 'flex', alignItems: 'center', gap: 28 }}>
    <div style={{ position: 'relative', width: row.icon, height: row.icon, flexShrink: 0 }}>
      <IconBadge icon="lock" size={row.icon} progress={progress} style={{ position: 'absolute', inset: 0, opacity: Math.min(1, progress * 1.5) * (1 - unlock), boxShadow: 'none' }} />
      <IconBadge icon="check" variant="emerald" size={row.icon} progress={unlock} style={{ position: 'absolute', inset: 0, boxShadow: 'none' }} />
    </div>
    <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: row.fontSize, lineHeight: 1.1, color: theme.color.slate900, whiteSpace: 'nowrap' }}>{label}</div>
  </SceneCard>
);

export const CrachaComDesbloqueios: React.FC<CrachaComDesbloqueiosProps & BaseProps> = ({
  program,
  role = 'Título conquistado',
  icon = 'user',
  title = 'E com ele veio mais.',
  accent,
  items = DEFAULT_ITEMS,
  revealAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const usableWidth = width - theme.safe.x * 2;
  const shown = (items.length ? items : DEFAULT_ITEMS).slice(0, ITEM_RANGE.max);
  const columnWidth = usableWidth - 720;
  const layout = badgeLayout(shown, estimateLines(title, columnWidth, TITLE_FONT, 'display'), usableWidth, height - theme.safe.y - 180);
  const times = unlockTimes(shown.length, revealAt);
  const drop = enter(frame, fps, times.badge, 0.6);
  const flip = badgeFlip(enter(frame, fps, times.badge, FLIP_SECONDS));
  const content = enter(frame, fps, times.badge + FLIP_SECONDS * 0.45, 0.5);
  const slide = enter(frame, fps, times.title - 0.45, 0.7);

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        <div
          style={{
            position: 'absolute',
            left: badgeX(layout, slide),
            top: layout.badge.top,
            width: layout.badge.width,
            height: layout.badge.height,
            opacity: Math.min(1, drop * 1.5),
            translate: `0px ${((1 - drop) * -90).toFixed(2)}px`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxSizing: 'border-box',
              padding: '34px 40px 40px',
              borderRadius: theme.radius.card,
              background: alpha(theme.color.white, 0.94),
              border: `2px solid ${alpha(theme.color.white, 0.9)}`,
              boxShadow: longShadow,
              transform: `perspective(1600px) rotateY(${flip.angle.toFixed(2)}deg)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 30,
            }}
          >
            <div style={{ width: 92, height: 18, flexShrink: 0, borderRadius: theme.radius.pill, background: alpha(theme.color.slate900, 0.14) }} />
            {flip.front ? (
              <>
                {program ? (
                  <Eyebrow progress={content} style={{ textAlign: 'center' }}>
                    {program}
                  </Eyebrow>
                ) : null}
                <IconBadge icon={icon} variant="ink" size={196} progress={content} style={{ boxShadow: 'none' }} />
                <div
                  style={{
                    fontFamily: theme.font.display,
                    fontWeight: 600,
                    fontSize: roleFontSize(role),
                    lineHeight: 1.12,
                    textAlign: 'center',
                    color: theme.color.slate900,
                    ...rise(enter(frame, fps, times.badge + FLIP_SECONDS * 0.45 + 0.12, 0.5), 20),
                  }}
                >
                  {role}
                </div>
                {/* uma luz por item: acende quando ele destrava */}
                <div style={{ marginTop: 'auto', display: 'flex', gap: 18, opacity: content }}>
                  {times.unlocks.map((unlockAt, index) => {
                    const on = enter(frame, fps, unlockAt, 0.4);
                    return <div key={index} style={{ width: 22, height: 22, borderRadius: theme.radius.pill, background: on > 0 ? alpha(theme.color.emerald, 0.25 + 0.75 * on) : alpha(theme.color.slate300, 0.7) }} />;
                  })}
                </div>
              </>
            ) : null}
          </div>
          <Lanyard width={layout.badge.width} />
        </div>

        <div style={{ position: 'absolute', left: layout.column.x, top: layout.column.top, width: layout.column.width, display: 'flex', flexDirection: 'column', gap: TITLE_GAP }}>
          <div style={{ opacity: frame >= times.title * fps ? 1 : 0 }}>
            <Statement text={title} accent={accent} atSec={times.title} fontSize={TITLE_FONT} align="left" maxWidth={layout.column.width} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: layout.row.gap }}>
            {shown.map((label, index) => (
              <UnlockRow key={index} label={label} progress={enter(frame, fps, times.items[index]!, 0.45)} unlock={enter(frame, fps, times.unlocks[index]!, 0.4)} indent={index * layout.row.indent} row={layout.row} />
            ))}
          </div>
        </div>
      </div>
    </SceneBackground>
  );
};

const SAMPLE_ITEMS = ['Deploy sem limite', 'Domínio próprio', 'Suporte prioritário', 'Relatórios semanais'];

export const entry: ComponentEntry = {
  component: CrachaComDesbloqueios,
  sample: {
    program: 'Plano Pro',
    role: 'Assinante anual',
    icon: 'bolt',
    title: 'E o que veio junto.',
    accent: 'veio junto',
    items: SAMPLE_ITEMS,
    revealAt: { badge: 0.5, title: 2.8, items: [4.2, 4.9, 5.6, 6.3] },
  },
  defaultDuration: 8,
  description:
    'Para a fala "virei X, e com isso ganhei A, B e C": um crachá com o título conquistado desce virando, encosta à esquerda e, ao lado, ' +
    'os benefícios aparecem trancados e destravam um a um. Serve para cargo novo, certificação, plano assinado, nível de um programa, permissão liberada.',
  tags: ['crachá', 'conquista', 'lista', 'desbloqueio', 'benefícios'],
  origin: { project: 'como-melhorei', date: '2026-10-12', scene: 'como-melhorei/Embaixador' },
  slots: [
    { name: 'program', type: 'string?', description: 'linha pequena no topo do crachá: quem concede (programa, empresa, plano)' },
    { name: 'role', type: 'string', description: 'o título conquistado, grande no crachá (até ~3 linhas curtas)' },
    { name: 'icon', type: 'IconName?', description: 'ícone no disco do crachá; padrão user' },
    { name: 'title', type: 'string', description: 'frase ao lado do crachá' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral' },
    { name: 'items', type: 'string[] (1 a 6)', description: 'o que destrava, na ordem da fala; a linha encolhe conforme a quantidade (até ~30 caracteres cada)' },
    { name: 'revealAt', type: '{ badge?: number; title?: number; items?: number[] }', description: 'segundo do crachá, da frase e de cada item por índice (o cadeado abre 0,3 s depois)' },
  ],
};
