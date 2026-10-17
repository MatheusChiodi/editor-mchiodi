import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { alpha, enter, Eyebrow, IconBadge, longShadow, rise, SceneBackground, SceneCard, Statement } from '../../scene-kit';
import { theme } from '../../theme';

export interface EmbaixadorReveal {
  /** "virando embaixador universitário": o crachá desce e vira */
  badge: number;
  /** "as coisas só melhoraram": o crachá abre espaço e entra a frase */
  better: number;
  /** "mentorias" */
  mentoring: number;
  competitions: number;
  community: number;
}

export interface EmbaixadorProps {
  /** segundos relativos ao início da cena */
  revealAt?: EmbaixadorReveal;
  /** nome do programa, no topo do crachá */
  program?: string;
  role?: string;
  title?: string;
  /** trecho do título em coral */
  accent?: string;
  mentoringLabel?: string;
  competitionsLabel?: string;
  communityLabel?: string;
}

export const EMBAIXADOR_REVEAL: EmbaixadorReveal = { badge: 0.5, better: 2.8, mentoring: 4.4, competitions: 5.2, community: 5.8 };

/** segundos entre o benefício aparecer (trancado) e destravar */
export const UNLOCK_DELAY = 0.3;
const FLIP_SECONDS = 0.9;

export interface BadgeLayout {
  width: number;
  height: number;
  badge: { width: number; height: number; top: number; centerX: number; restX: number };
  column: { x: number; width: number; top: number };
  row: { height: number; gap: number; indent: number };
}

/** Crachá à esquerda (começa no centro e desliza) e, à direita, a frase com os três benefícios em degraus. */
export function badgeLayout(width = 1728, height = 836): BadgeLayout {
  const badge = { width: 540, height: 620 };
  const restX = 70;
  const columnX = restX + badge.width + 110;
  const row = { height: 108, gap: 22, indent: 56 };
  const columnHeight = 86 + 52 + row.height * 3 + row.gap * 2;
  return {
    width,
    height,
    badge: { ...badge, top: height - badge.height - 30, centerX: (width - badge.width) / 2, restX },
    column: { x: columnX, width: width - columnX, top: Math.round((height - columnHeight) / 2) },
    row,
  };
}

/** x do crachá: no centro até a fala virar, depois encosta à esquerda (`progress` 0→1). */
export function badgeX(layout: BadgeLayout, progress: number): number {
  return layout.badge.centerX + (layout.badge.restX - layout.badge.centerX) * progress;
}

/** Giro do crachá: entra de costas (180°) e termina de frente (0°); a frente só aparece depois dos 90°. */
export function badgeFlip(progress: number): { angle: number; front: boolean } {
  const angle = (1 - Math.max(0, Math.min(1, progress))) * 180;
  return { angle, front: angle < 90 };
}

export interface Benefit {
  key: 'mentoring' | 'competitions' | 'community';
  label: string;
  /** quando a linha entra, ainda com o cadeado */
  at: number;
  /** quando o cadeado vira o "check" verde */
  unlockAt: number;
}

/** Os três benefícios na ordem da fala, com o momento em que cada um destrava. */
export function benefitTimes(revealAt: EmbaixadorReveal, labels: [string, string, string]): Benefit[] {
  const keys = ['mentoring', 'competitions', 'community'] as const;
  return keys.map((key, index) => ({ key, label: labels[index]!, at: revealAt[key], unlockAt: revealAt[key] + UNLOCK_DELAY }));
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

const BenefitRow: React.FC<{ label: string; progress: number; unlock: number; indent: number; height: number }> = ({ label, progress, unlock, indent, height }) => (
  <SceneCard
    progress={progress}
    padding="0 44px 0 18px"
    style={{ marginLeft: indent, height, width: 'fit-content', display: 'flex', alignItems: 'center', gap: 28 }}
  >
    <div style={{ position: 'relative', width: 76, height: 76 }}>
      <IconBadge icon="lock" size={76} progress={progress} style={{ position: 'absolute', inset: 0, opacity: Math.min(1, progress * 1.5) * (1 - unlock), boxShadow: 'none' }} />
      <IconBadge icon="check" variant="emerald" size={76} progress={unlock} style={{ position: 'absolute', inset: 0, boxShadow: 'none' }} />
    </div>
    <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: 46, lineHeight: 1.1, color: theme.color.slate900 }}>{label}</div>
  </SceneCard>
);

/** Virei embaixador universitário: o crachá chega virando e, com ele, mentorias, competições e comunidade destravam. */
export const Embaixador: React.FC<EmbaixadorProps & BaseProps> = ({
  revealAt = EMBAIXADOR_REVEAL,
  program = 'Campus Expert',
  role = 'Embaixador universitário',
  title = 'E as coisas só melhoraram.',
  accent = 'só melhoraram',
  mentoringLabel = 'Mentorias',
  competitionsLabel = 'Competições',
  communityLabel = 'Comunidade',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const layout = badgeLayout(width - theme.safe.x * 2, height - theme.safe.y - 180);
  const benefits = benefitTimes(revealAt, [mentoringLabel, competitionsLabel, communityLabel]);
  const drop = enter(frame, fps, revealAt.badge, 0.6);
  const flip = badgeFlip(enter(frame, fps, revealAt.badge, FLIP_SECONDS));
  const content = enter(frame, fps, revealAt.badge + FLIP_SECONDS * 0.45, 0.5);
  const slide = enter(frame, fps, revealAt.better - 0.45, 0.7);

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
            <div style={{ width: 92, height: 18, borderRadius: theme.radius.pill, background: alpha(theme.color.slate900, 0.14) }} />
            {flip.front ? (
              <>
                <Eyebrow progress={content}>{program}</Eyebrow>
                <IconBadge icon="user" variant="ink" size={196} progress={content} style={{ boxShadow: 'none' }} />
                <div
                  style={{
                    fontFamily: theme.font.display,
                    fontWeight: 600,
                    fontSize: 58,
                    lineHeight: 1.12,
                    textAlign: 'center',
                    color: theme.color.slate900,
                    ...rise(enter(frame, fps, revealAt.badge + FLIP_SECONDS * 0.45 + 0.12, 0.5), 20),
                  }}
                >
                  {role}
                </div>
                {/* uma luz por benefício: acende quando ele destrava */}
                <div style={{ marginTop: 'auto', display: 'flex', gap: 18, opacity: content }}>
                  {benefits.map((benefit) => {
                    const on = enter(frame, fps, benefit.unlockAt, 0.4);
                    return (
                      <div
                        key={benefit.key}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: theme.radius.pill,
                          background: on > 0 ? alpha(theme.color.emerald, 0.25 + 0.75 * on) : alpha(theme.color.slate300, 0.7),
                        }}
                      />
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
          <Lanyard width={layout.badge.width} />
        </div>

        <div style={{ position: 'absolute', left: layout.column.x, top: layout.column.top, width: layout.column.width, display: 'flex', flexDirection: 'column', gap: 52 }}>
          <div style={{ opacity: frame >= revealAt.better * fps ? 1 : 0 }}>
            <Statement text={title} accent={accent} atSec={revealAt.better} fontSize={72} align="left" maxWidth={layout.column.width} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: layout.row.gap }}>
            {benefits.map((benefit, index) => (
              <BenefitRow
                key={benefit.key}
                label={benefit.label}
                progress={enter(frame, fps, benefit.at, 0.45)}
                unlock={enter(frame, fps, benefit.unlockAt, 0.4)}
                indent={index * layout.row.indent}
                height={layout.row.height}
              />
            ))}
          </div>
        </div>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: Embaixador,
  sample: { revealAt: EMBAIXADOR_REVEAL },
  defaultDuration: 7,
  description:
    'Cena papel: o crachá "Campus Expert — Embaixador universitário" desce virando e, depois, destravam mentorias, competições e comunidade. Para a fala sobre virar embaixador e o que veio junto.',
};

export const MODEL = 'CrachaComDesbloqueios';
