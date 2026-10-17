import type { BaseProps } from '../anim';
import { theme } from '../theme';
import { NoticeCard } from './c1-kit';
import type { ComponentEntry } from './registry';

export interface TipCardProps {
  title?: string;
  text: string;
}

export const TIP_LABEL = 'Dica';

/** Rótulo da pílula: o título informado ou "Dica". */
export function tipLabel(title?: string): string {
  return title?.trim() || TIP_LABEL;
}

const Lightbulb: React.FC<{ progress: number }> = ({ progress }) => {
  const dash = { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - progress };
  return (
    <svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke={theme.color.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {progress > 0 ? (
        <>
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" {...dash} />
          <path d="M9 18h6" {...dash} />
          <path d="M10 22h4" {...dash} />
        </>
      ) : null}
    </svg>
  );
};

export const TipCard: React.FC<TipCardProps & BaseProps> = ({ title, text, durationInFrames }) => (
  <NoticeCard
    label={tipLabel(title)}
    text={text}
    accent={theme.color.slate600}
    dot={theme.color.coral}
    icon={(progress) => <Lightbulb progress={progress} />}
    durationInFrames={durationInFrames}
  />
);

export const entry: ComponentEntry = {
  component: TipCard,
  sample: {
    text: 'Use git stash antes de trocar de branch — o trabalho pela metade fica guardado.',
  },
  defaultDuration: 6,
  vertical: { zone: 'top' },
  description: 'Dica prática ou atalho que complementa a fala, sem interromper a explicação principal.',
};
