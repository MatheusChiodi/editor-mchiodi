import { AbsoluteFill } from 'remotion';

import type { BaseProps } from '../anim';
import { EnterText } from '../arsenal/Enter';
import { entrances } from '../arsenal/entrances';
import { theme } from '../theme';
import type { ComponentEntry } from './registry';

export type TextRevealPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type TextRevealSize = 'small' | 'medium' | 'large' | 'huge';

export interface TextRevealProps {
  text: string;
  /** id de um dos 50 efeitos de entrada do arsenal (`pnpm mce arsenal entrances`) */
  entrance?: string;
  position?: TextRevealPosition;
  size?: TextRevealSize;
  /** `display` = Playfair (títulos); `body` = Inter */
  font?: 'display' | 'body';
  /** texto branco com contorno (sobre o vídeo) ou dentro de um cartão claro */
  surface?: 'outline' | 'card';
  /** destaca o texto inteiro em coral: só para uma palavra ou expressão curta */
  accent?: boolean;
}

export const TEXT_SIZES: Record<TextRevealSize, number> = { small: 44, medium: 64, large: 96, huge: 140 };
export const DEFAULT_ENTRANCE = 'fade-up';

/** Efeito pedido, ou o padrão se o id não existir no arsenal (EDL antiga, erro de digitação). */
export function resolveEntrance(id: string | undefined, known: Record<string, unknown> = entrances): string {
  if (id && id in known) return id;
  return DEFAULT_ENTRANCE in known ? DEFAULT_ENTRANCE : Object.keys(known)[0]!;
}

/** Onde o bloco de texto fica na tela, respeitando a margem segura e a faixa das legendas. */
export function placement(position: TextRevealPosition): { justifyContent: string; alignItems: string; textAlign: 'center' | 'left' | 'right' } {
  switch (position) {
    case 'top':
      return { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center' };
    case 'bottom':
      return { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' };
    case 'left':
      return { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left' };
    case 'right':
      return { justifyContent: 'center', alignItems: 'flex-end', textAlign: 'right' };
    default:
      return { justifyContent: 'center', alignItems: 'center', textAlign: 'center' };
  }
}

/** Texto longo desce um degrau de tamanho para caber em até ~3 linhas. */
export function fitSize(text: string, size: TextRevealSize): number {
  const base = TEXT_SIZES[size];
  const budget = { small: 140, medium: 90, large: 54, huge: 26 }[size];
  return text.length <= budget ? base : Math.max(TEXT_SIZES.small, Math.round(base * Math.sqrt(budget / text.length)));
}

/**
 * Texto livre com qualquer efeito de entrada do arsenal. É a porta de entrada dos 50 presets
 * na EDL: o diretor escolhe a frase e o efeito, sem precisar de um componente novo.
 */
export const TextReveal: React.FC<TextRevealProps & BaseProps> = ({
  text,
  entrance,
  position = 'center',
  size = 'large',
  font = 'display',
  surface = 'outline',
  accent = false,
  durationInFrames,
}) => {
  const place = placement(position);
  const fontSize = fitSize(text, size);
  const card = surface === 'card';
  const color = accent ? theme.color.coral : card ? theme.color.slate900 : theme.color.white;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: place.justifyContent,
        alignItems: place.alignItems,
        padding: `${theme.safe.y + 40}px ${theme.safe.x}px ${theme.safe.y + 180}px`,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          padding: card ? '36px 48px' : 0,
          borderRadius: theme.radius.card,
          background: card ? 'rgba(248,248,242,0.96)' : 'transparent',
          boxShadow: card ? theme.shadow.raised : 'none',
        }}
      >
        <EnterText
          preset={resolveEntrance(entrance)}
          text={text}
          durationInFrames={durationInFrames}
          exit
          style={{
            fontFamily: font === 'display' ? theme.font.display : theme.font.body,
            fontWeight: font === 'display' ? 600 : 800,
            fontSize,
            lineHeight: 1.15,
            textAlign: place.textAlign,
            color,
            // sobre o vídeo, o contorno escuro garante leitura em qualquer fundo (como nas legendas)
            WebkitTextStroke: card ? undefined : `${Math.max(6, Math.round(fontSize / 9))}px ${theme.color.ink}`,
            paintOrder: 'stroke fill',
            textShadow: card ? undefined : '0 8px 24px rgba(0,0,0,0.45)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const entry: ComponentEntry = {
  component: TextReveal,
  sample: { text: 'Full stack não é saber tudo', entrance: 'fade-up', position: 'center', size: 'large' },
  defaultDuration: 3.5,
  description: 'Frase ou palavra solta na tela com qualquer um dos 50 efeitos de entrada do arsenal; para reforçar o que acabou de ser dito.',
};
