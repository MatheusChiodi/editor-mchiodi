// O que os modelos de analogia (motion/src/scenes/modelos/Analogia*.tsx) têm em comum: o palco no tema pedido,
// o cartão de item e a plaqueta de nome. O layout de cada modelo é uma função pura no arquivo dele.

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { presence } from '../../anim';
import { Icon, type IconName, isIconName } from '../../scene-kit';
import { motion, theme as brand } from '../../theme';
import { getTheme } from '../index';
import type { Actor } from '../types';
import { type AnalogyTheme, Chrome, ThemePanel } from './kit';
import { clamp01, fade, fitFont } from './math';

/** Props que todo modelo de analogia aceita. */
export interface AnalogyBaseProps {
  /** universo da analogia (`pnpm mce arsenal themes`): batman, minecraft, mario, matrix, star-wars, rpg… Sem valor, o estilo padrão do canal */
  theme?: string;
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral: o único acento da tela */
  accent?: string;
  /** 0–1: quanto de atmosfera do universo entra. No tom sóbrio (STYLE.md §9), ~0.4 */
  intensity?: number;
}

export interface AnalogyStageProps {
  themeId?: string;
  actors: Actor[];
  ground: number;
  intensity?: number;
  durationInFrames: number;
  children: (theme: AnalogyTheme) => React.ReactNode;
}

/** Palco de um modelo de analogia: resolve o tema, desenha o mundo com as figuras e entrega o tema para a interface. */
export const AnalogyStage: React.FC<AnalogyStageProps> = ({ themeId, actors, ground, intensity = 1, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getTheme(themeId);
  const { World } = theme;
  const opacity = presence(frame, fps, durationInFrames, motion.fast, motion.fast).value;
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: theme.spec.palette.sky[0] }}>
      <World actors={actors} ground={ground} intensity={clamp01(intensity)} durationInFrames={durationInFrames}>
        <AbsoluteFill>{children(theme)}</AbsoluteFill>
      </World>
    </AbsoluteFill>
  );
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ItemCardProps {
  theme: AnalogyTheme;
  box: Box;
  label: string;
  hint?: string;
  icon?: string;
  /** 0→1: entrada */
  progress: number;
  /** de onde o cartão vem voando (px), para "ser servido" pelo ajudante */
  from?: { x: number; y: number };
  tone?: 'default' | 'primary' | 'ok' | 'danger' | 'muted';
  /** número de ordem ou tecla, na fonte do universo, no canto do cartão */
  tag?: string;
}

/** Cartão de um item de conteúdo (ícone do canal + rótulo em Inter) com o acabamento do tema. Posição absoluta em px. */
export const ItemCard: React.FC<ItemCardProps> = ({ theme, box, label, hint, icon, progress, from, tone = 'default', tag }) => {
  const { palette } = theme.spec;
  const p = clamp01(progress);
  const dx = from ? (from.x - (box.x + box.w / 2)) * (1 - p) : 0;
  const dy = from ? (from.y - (box.y + box.h / 2)) * (1 - p) : 0;
  const iconSize = Math.min(64, box.h * 0.36);
  const labelSize = fitFont(label, box.w - 40, 38, 30);
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, translate: `${dx.toFixed(1)}px ${dy.toFixed(1)}px`, scale: String(from ? 0.55 + 0.45 * p : 1) }}>
      <ThemePanel theme={theme} tone={tone} progress={Math.min(1, p * 1.6)} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 20px', textAlign: 'center' }}>
        {tag ? (
          <Chrome theme={theme} size={22} color={palette.panelMuted} style={{ position: 'absolute', left: 14, top: 10 }}>
            {tag}
          </Chrome>
        ) : null}
        {icon && isIconName(icon) ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: iconSize + 20, height: iconSize + 20, borderRadius: theme.panel.radius > 12 ? 999 : Math.max(0, theme.panel.radius - 2), background: fade(palette.primary, theme.spec.dark ? 0.16 : 0.2), border: `2px solid ${fade(palette.primary, 0.55)}` }}>
            <Icon name={icon as IconName} size={iconSize} color={palette.panelText} strokeWidth={theme.iconStroke} draw={clamp01(p * 1.4 - 0.2)} />
          </div>
        ) : null}
        <div style={{ fontFamily: brand.font.body, fontWeight: 600, fontSize: labelSize, lineHeight: 1.12, color: palette.panelText }}>{label}</div>
        {hint ? <div style={{ fontFamily: brand.font.body, fontWeight: 500, fontSize: 30, lineHeight: 1.15, color: palette.panelMuted }}>{hint}</div> : null}
      </ThemePanel>
    </div>
  );
};

export interface PlaqueProps {
  theme: AnalogyTheme;
  /** centro horizontal e topo, em px */
  x: number;
  y: number;
  width: number;
  /** o nome de conteúdo (Inter) */
  label: string;
  /** o papel no universo, na fonte de apoio do tema */
  sub?: string;
  /** linha de apoio em Inter, abaixo do nome */
  hint?: string;
  progress: number;
  tone?: 'default' | 'primary' | 'ok' | 'danger' | 'muted';
  labelSize?: number;
}

/** Plaqueta de nome sob uma figura: quem é (conteúdo) e o papel no universo (fonte de apoio). */
export const Plaque: React.FC<PlaqueProps> = ({ theme, x, y, width, label, sub, hint, progress, tone = 'default', labelSize = 38 }) => {
  const { palette } = theme.spec;
  return (
    <div style={{ position: 'absolute', left: x - width / 2, top: y, width, display: 'flex', justifyContent: 'center' }}>
      <ThemePanel theme={theme} tone={tone} progress={clamp01(progress)} style={{ maxWidth: width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 20px 12px', textAlign: 'center' }}>
        {sub ? (
          <Chrome theme={theme} size={22} color={theme.spec.dark ? palette.primary : palette.panelMuted}>
            {sub}
          </Chrome>
        ) : null}
        <div style={{ fontFamily: brand.font.body, fontWeight: 700, fontSize: fitFont(label, width - 44, labelSize, 30), lineHeight: 1.1, color: palette.panelText }}>{label}</div>
        {hint ? <div style={{ fontFamily: brand.font.body, fontWeight: 500, fontSize: fitFont(hint, width - 44, 30, 26), lineHeight: 1.15, color: palette.panelMuted }}>{hint}</div> : null}
      </ThemePanel>
    </div>
  );
};

/** Distribui `count` caixas de largura `w` centradas em `centerX`, com `gap` entre elas. */
export function rowBoxes(count: number, centerX: number, y: number, w: number, h: number, gap: number): Box[] {
  const total = count * w + (count - 1) * gap;
  return Array.from({ length: count }, (_, index) => ({ x: centerX - total / 2 + index * (w + gap), y, w, h }));
}
