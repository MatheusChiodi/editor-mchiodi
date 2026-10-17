import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { Arrow, enter, IconBadge, type IconName, Pill, type Point, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';

export interface FullStackProps {
  /** segundos relativos ao início da cena */
  revealAt?: {
    /** quando a fala chega em "front-end" */
    front: number;
    /** quando a fala chega em "back-end" */
    back: number;
    /** fecho: a mesma pessoa faz os dois */
    both: number;
  };
  title?: string;
  /** trecho do título em coral */
  accent?: string;
  eyebrow?: string;
  frontHint?: string;
  backHint?: string;
  bothLabel?: string;
}

const DEFAULT_REVEAL = { front: 3.0, back: 4.3, both: 5.4 };

export interface FullStackLayout {
  width: number;
  height: number;
  card: { width: number; height: number };
  /** x do canto esquerdo de cada cartão */
  frontX: number;
  backX: number;
  badge: { size: number; center: Point };
  toFront: { from: Point; to: Point };
  toBack: { from: Point; to: Point };
}

/** Diagrama da cena: dois cartões nas pontas, a pessoa no meio e uma seta para cada lado. */
export function fullStackLayout(width: number, height = 400): FullStackLayout {
  const cardWidth = Math.round(width * 0.36);
  const badgeSize = 168;
  const center: Point = [width / 2, height / 2];
  const gap = 26;
  return {
    width,
    height,
    card: { width: cardWidth, height },
    frontX: 0,
    backX: width - cardWidth,
    badge: { size: badgeSize, center },
    toFront: { from: [center[0] - badgeSize / 2 - gap, center[1]], to: [cardWidth + gap, center[1]] },
    toBack: { from: [center[0] + badgeSize / 2 + gap, center[1]], to: [width - cardWidth - gap, center[1]] },
  };
}

const Side: React.FC<{ icon: IconName; name: string; hint: string; progress: number; layout: FullStackLayout; x: number }> = ({
  icon,
  name,
  hint,
  progress,
  layout,
  x,
}) => (
  <SceneCard
    progress={progress}
    padding="40px 44px"
    style={{
      position: 'absolute',
      left: x,
      top: 0,
      width: layout.card.width,
      height: layout.card.height,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 22,
    }}
  >
    <IconBadge icon={icon} size={112} progress={progress} />
    <div style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: text.cardTitle, lineHeight: 1.1, color: theme.color.slate900 }}>{name}</div>
    <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: text.label, lineHeight: 1.3, color: theme.color.slate600 }}>{hint}</div>
  </SceneCard>
);

/** O que é um dev full stack: uma pessoa no meio, front-end de um lado e back-end do outro. */
export const FullStack: React.FC<FullStackProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  title = 'Uma pessoa, as duas pontas.',
  accent = 'as duas pontas',
  eyebrow = 'Dev full stack',
  frontHint = 'O que você vê: as telinhas bonitas.',
  backHint = 'O que roda por trás: regras e banco de dados.',
  bothLabel = 'faz os dois',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const layout = fullStackLayout(width - theme.safe.x * 2);
  const person = enter(frame, fps, 0.9);
  const front = enter(frame, fps, revealAt.front, 0.5);
  const back = enter(frame, fps, revealAt.back, 0.5);
  const both = enter(frame, fps, revealAt.both, 0.5);
  const half = layout.badge.size / 2;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 64 }}>
      <Statement text={title} accent={accent} eyebrow={eyebrow} fontSize={92} />
      <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
        <Side icon="browser" name="Front-end" hint={frontHint} progress={front} layout={layout} x={layout.frontX} />
        <Side icon="database" name="Back-end" hint={backHint} progress={back} layout={layout} x={layout.backX} />
        <Arrow {...layout.toFront} progress={enter(frame, fps, revealAt.front + 0.1, 0.5)} />
        <Arrow {...layout.toBack} progress={enter(frame, fps, revealAt.back + 0.1, 0.5)} />
        <IconBadge
          icon="user"
          variant="ink"
          size={layout.badge.size}
          progress={person}
          style={{ position: 'absolute', left: layout.badge.center[0] - half, top: layout.badge.center[1] - half }}
        />
        <div style={{ position: 'absolute', left: 0, right: 0, top: layout.badge.center[1] + half + 28, display: 'flex', justifyContent: 'center' }}>
          <Pill variant="emerald" dot progress={both}>
            {bothLabel}
          </Pill>
        </div>
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: FullStack,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 6.8,
  description: 'Cena papel: o que é um dev full stack. Uma pessoa no meio; front-end e back-end entram quando a fala cita cada um.',
};

export const MODEL = 'HubComSatelites';
