import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { motion, theme } from '../theme';
import type { ComponentEntry } from './registry';

export interface LowerThirdProps {
  title: string;
  subtitle?: string;
  link?: string;
  side?: 'left' | 'right';
}

/** Link como se fala em voz alta: sem protocolo, `www.` nem barra final. */
export function displayLink(link: string): string {
  return link
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[/?#]+$/, '');
}

const SLIDE = 72;

const LinkIcon: React.FC = () => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={theme.color.coralDeep} strokeWidth={2.4} strokeLinecap="round">
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
  </svg>
);

export const LowerThird: React.FC<LowerThirdProps & BaseProps> = ({ title, subtitle, link, side = 'left', durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const direction = side === 'left' ? -1 : 1;
  const accent = progressAt(frame, fps, 0.1, motion.base);
  const line = (index: number) => {
    const progress = progressAt(frame, fps, stagger(index, 0.08, 0.1));
    return { opacity: progress, translate: `0 ${(1 - progress) * 14}px` };
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: side === 'left' ? 'flex-start' : 'flex-end',
        paddingLeft: theme.safe.x,
        paddingRight: theme.safe.x,
        paddingBottom: theme.safe.y + 56,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 28,
          maxWidth: 980,
          padding: '30px 44px 32px 30px',
          background: theme.color.paper,
          borderRadius: theme.radius.card,
          boxShadow: theme.shadow.raised,
          opacity: value,
          translate: `${((1 - enter) * SLIDE + exit * 28) * direction}px 0`,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 8,
            borderRadius: theme.radius.pill,
            background: theme.color.coral,
            scale: `1 ${accent}`,
            transformOrigin: 'center bottom',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div
            style={{
              ...line(0),
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: 56,
              lineHeight: 1.12,
              letterSpacing: '-0.01em',
              color: theme.color.ink,
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                ...line(1),
                fontFamily: theme.font.body,
                fontWeight: 500,
                fontSize: 30,
                lineHeight: 1.3,
                color: theme.color.slate600,
                overflowWrap: 'anywhere',
              }}
            >
              {subtitle}
            </div>
          ) : null}
          {link ? (
            <div
              style={{
                ...line(subtitle ? 2 : 1),
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 6,
                fontFamily: theme.font.body,
                fontWeight: 600,
                fontSize: 26,
                lineHeight: 1.3,
                color: theme.color.coralDeep,
              }}
            >
              <div style={{ flexShrink: 0, display: 'flex' }}>
                <LinkIcon />
              </div>
              <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{displayLink(link)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: LowerThird,
  sample: {
    title: 'Matheus Chiodi',
    subtitle: 'Desenvolvedor full stack · canal MChiodi',
    link: 'https://www.mchiodi.dev/',
  },
  defaultDuration: 5,
  description: 'Identifica quem fala (nome e cargo) na primeira aparição, ou mostra o link/fonte no momento em que é citado.',
};
