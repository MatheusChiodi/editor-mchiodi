import { theme } from '../theme';
import { MONO_ADVANCE, type Token, type TokenType } from './CodeCard';
import { withAlpha } from './SectionTitle';

/** Tons de status legíveis sobre superfície escura (rose-400, amber-400), que o `theme.ts` não expõe. */
export const darkTone = {
  rose: '#fb7185',
  amber: '#fbbf24',
} as const;

/** Corta o texto em `max` caracteres, terminando em reticências quando não cabe. */
export function clip(text: string, max: number): string {
  if (max <= 0) return '';
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** Quantas colunas monoespaçadas cabem em `width` no corpo `fontSize`. */
export function monoColumns(width: number, fontSize: number): number {
  return Math.max(1, Math.floor(width / (fontSize * MONO_ADVANCE)));
}

/** Largura estimada de um texto em Inter (média de 0.56em por caractere em peso 600). */
export function textWidth(text: string, fontSize: number, ratio = 0.56): number {
  return text.length * fontSize * ratio;
}

export const tokenColor: Record<TokenType, string> = {
  keyword: theme.color.coral,
  string: theme.color.emerald,
  number: theme.color.glowPeach,
  comment: theme.color.slate300,
  punctuation: theme.color.slate300,
  identifier: theme.color.paper,
  function: theme.color.glowPeriwinkle,
  plain: theme.color.paper,
};

export const CodeTokens: React.FC<{ tokens: readonly Token[] }> = ({ tokens }) => (
  <>
    {tokens.map((token, index) => (
      <span
        key={index}
        style={{
          color: tokenColor[token.type],
          opacity: token.type === 'comment' ? 0.6 : 1,
          fontStyle: token.type === 'comment' ? 'italic' : 'normal',
        }}
      >
        {token.text}
      </span>
    ))}
  </>
);

export const WINDOW_BAR = 68;
export const WINDOW_PAD_X = 44;
export const WINDOW_PAD_Y = 30;

interface DarkWindowProps {
  width: number;
  title?: string;
  /** rótulo discreto no canto direito da barra */
  tag?: string;
  enter: number;
  exit: number;
  value: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** Janela escura com a mesma moldura do CodeCard: é a exceção de código/terminal do design system. */
export const DarkWindow: React.FC<DarkWindowProps> = ({ width, title, tag, enter, exit, value, style, children }) => (
  <div
    style={{
      width,
      borderRadius: theme.radius.card,
      overflow: 'hidden',
      background: theme.color.slate900,
      boxShadow: `${theme.shadow.raised}, 0 0 0 1px ${theme.color.slate600}`,
      opacity: enter * (1 - exit),
      translate: `0 ${(1 - enter) * 28 + exit * 16}px`,
      scale: String(0.97 + 0.03 * value),
      ...style,
    }}
  >
    <div
      style={{
        height: WINDOW_BAR,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: `0 ${WINDOW_PAD_X - 14}px`,
        background: theme.color.night,
      }}
    >
      {[theme.color.coral, theme.color.glowPeach, theme.color.emerald].map((color) => (
        <div key={color} style={{ flexShrink: 0, width: 16, height: 16, borderRadius: theme.radius.pill, background: color }} />
      ))}
      <div
        style={{
          marginLeft: 16,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: theme.font.mono,
          fontWeight: 500,
          fontSize: 24,
          color: theme.color.slate300,
        }}
      >
        {title}
      </div>
      {tag ? (
        <div
          style={{
            flexShrink: 0,
            fontFamily: theme.font.body,
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: theme.color.slate600,
          }}
        >
          {tag}
        </div>
      ) : null}
    </div>
    {children}
  </div>
);

export const monoText = (fontSize: number, lineHeight: number): React.CSSProperties => ({
  fontFamily: theme.font.mono,
  fontWeight: 500,
  fontSize,
  lineHeight: `${lineHeight}px`,
  fontVariantLigatures: 'none',
  whiteSpace: 'pre',
});

interface BandProps {
  color: string;
  /** 0–1 */
  progress: number;
  /** quanto a faixa vaza para os lados (o padding do contêiner) */
  bleed: number;
  strength?: number;
}

/** Faixa translúcida atrás de uma linha, com a barra cheia na borda esquerda. */
export const LineBand: React.FC<BandProps> = ({ color, progress, bleed, strength = 0.2 }) => (
  <>
    <div
      style={{
        position: 'absolute',
        inset: `0 ${-bleed}px`,
        background: color,
        opacity: strength * progress,
        scale: `${progress} 1`,
        transformOrigin: 'left center',
      }}
    />
    <div style={{ position: 'absolute', left: -bleed, top: 0, bottom: 0, width: 6, background: color, opacity: progress }} />
  </>
);

export const eyebrow = (fontSize = 22, color: string = '#64748b'): React.CSSProperties => ({
  fontFamily: theme.font.body,
  fontWeight: 600,
  fontSize,
  lineHeight: 1.3,
  letterSpacing: '0.3em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  color,
});

export type IconName = 'folder' | 'file' | 'lock' | 'image' | 'monitor' | 'server' | 'database' | 'alert' | 'chevron';

const iconPaths: Record<IconName, string[]> = {
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  file: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'],
  lock: ['M6 11h12v9H6z', 'M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11'],
  image: ['M4 5h16v14H4z', 'M4 16l4.5-4.5 4 4 3-3L20 16', 'M9 9.5h.01'],
  monitor: ['M3 5h18v11H3z', 'M8 20h8', 'M12 16v4'],
  server: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M8 7h.01', 'M8 17h.01'],
  database: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  alert: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15 9l-6 6', 'M9 9l6 6'],
  chevron: ['M9 6l6 6-6 6'],
};

/** Ícones de traço fino no estilo lucide, desenhados à mão (sem dependência nem logo de terceiros). */
export const Icon: React.FC<{ name: IconName; size: number; color: string; strokeWidth?: number }> = ({
  name,
  size,
  color,
  strokeWidth = 1.8,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {iconPaths[name].map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);

export type WireKind = 'heading' | 'text' | 'button' | 'image' | 'input' | 'list';

export interface WireBlockSpec {
  kind: WireKind;
  label?: string;
}

/** Altura natural de cada bloco de wireframe (em px, na escala 1) e o respiro entre eles. */
export const WIRE_HEIGHT: Record<WireKind, number> = { heading: 64, text: 78, button: 68, image: 200, input: 68, list: 172 };
export const WIRE_GAP = 26;

export interface WireLayout {
  blocks: WireBlockSpec[];
  /** altura final de cada bloco, já comprimida para caber */
  heights: number[];
  scale: number;
}

/**
 * Encaixa os blocos na altura disponível: limita a quantidade e, se ainda sobrar conteúdo,
 * comprime primeiro as imagens (até 45%) e só depois o conjunto inteiro.
 */
export function fitWire(blocks: readonly WireBlockSpec[], available: number, maxBlocks = 6, heightScale = 1): WireLayout {
  const shown = blocks.slice(0, maxBlocks);
  const natural = shown.map((block) => WIRE_HEIGHT[block.kind] * heightScale);
  const gaps = WIRE_GAP * heightScale * Math.max(0, shown.length - 1);
  const total = natural.reduce((sum, height) => sum + height, 0) + gaps;
  if (total <= available || shown.length === 0) return { blocks: shown, heights: natural, scale: 1 };

  const imageTotal = shown.reduce((sum, block, index) => (block.kind === 'image' ? sum + natural[index]! : sum), 0);
  const excess = total - available;
  const imageCut = Math.min(excess, imageTotal * 0.55);
  const afterImages = natural.map((height, index) =>
    shown[index]!.kind === 'image' && imageTotal > 0 ? height - (imageCut * height) / imageTotal : height,
  );
  const remaining = total - imageCut;
  const scale = remaining <= available ? 1 : available / remaining;
  return { blocks: shown, heights: afterImages.map((height) => height * scale), scale };
}

interface WireBlockProps {
  block: WireBlockSpec;
  height: number;
  /** escala tipográfica (telas estreitas, como a do celular, usam < 1) */
  scale: number;
  /** 0–1 */
  appear: number;
}

const bar = (width: string, height: number, color: string): React.CSSProperties => ({
  width,
  height,
  borderRadius: theme.radius.pill,
  background: color,
});

const oneLine: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 };

/** Um bloco de wireframe: com `label` mostra o texto real; sem, mostra barras neutras. */
export const WireBlock: React.FC<WireBlockProps> = ({ block, height, scale, appear }) => {
  const { kind, label } = block;
  const soft = withAlpha(theme.color.slate300, 0.75);
  const base: React.CSSProperties = {
    height,
    flexShrink: 0,
    display: 'flex',
    opacity: appear,
    translate: `0 ${(1 - appear) * 16}px`,
  };

  if (kind === 'heading') {
    return (
      <div style={{ ...base, alignItems: 'center' }}>
        {label ? (
          <div
            style={{
              ...oneLine,
              fontFamily: theme.font.display,
              fontWeight: 600,
              fontSize: Math.min(52 * scale, height * 0.8),
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: theme.color.slate900,
            }}
          >
            {label}
          </div>
        ) : (
          <div style={bar('58%', height * 0.42, theme.color.slate900)} />
        )}
      </div>
    );
  }
  if (kind === 'text') {
    return (
      <div style={{ ...base, flexDirection: 'column', justifyContent: 'center', gap: height * 0.16 }}>
        {label ? (
          <div
            style={{
              fontFamily: theme.font.body,
              fontWeight: 500,
              fontSize: Math.min(28 * scale, height * 0.36),
              lineHeight: 1.3,
              color: theme.color.slate600,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {label}
          </div>
        ) : (
          ['100%', '92%', '64%'].map((width) => <div key={width} style={bar(width, height * 0.15, soft)} />)
        )}
      </div>
    );
  }
  if (kind === 'button') {
    return (
      <div style={{ ...base, alignItems: 'center' }}>
        <div
          style={{
            ...oneLine,
            maxWidth: '100%',
            boxSizing: 'border-box',
            height: height * 0.9,
            minWidth: 220 * scale,
            padding: `0 ${40 * scale}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.pill,
            background: theme.color.slate900,
            boxShadow: theme.shadow.card,
            fontFamily: theme.font.body,
            fontWeight: 600,
            fontSize: Math.min(28 * scale, height * 0.42),
            color: theme.color.white,
          }}
        >
          <span style={oneLine}>{label ?? ''}</span>
        </div>
      </div>
    );
  }
  if (kind === 'input') {
    return (
      <div style={{ ...base, alignItems: 'center' }}>
        <div
          style={{
            width: '72%',
            boxSizing: 'border-box',
            height: height * 0.9,
            padding: `0 ${30 * scale}px`,
            display: 'flex',
            alignItems: 'center',
            borderRadius: theme.radius.pill,
            background: theme.color.white,
            border: `2px solid ${theme.color.slate300}`,
            fontFamily: theme.font.body,
            fontWeight: 500,
            fontSize: Math.min(26 * scale, height * 0.4),
            color: '#64748b',
          }}
        >
          <span style={oneLine}>{label ?? ''}</span>
        </div>
      </div>
    );
  }
  if (kind === 'list') {
    const rows = 3;
    const rowHeight = height / rows;
    return (
      <div style={{ ...base, flexDirection: 'column' }}>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            style={{
              height: rowHeight,
              display: 'flex',
              alignItems: 'center',
              gap: 18 * scale,
              borderTop: index ? `1px solid ${soft}` : undefined,
            }}
          >
            <div style={{ flexShrink: 0, width: rowHeight * 0.52, height: rowHeight * 0.52, borderRadius: 12 * scale, background: soft }} />
            {label && index === 0 ? (
              <div style={{ ...oneLine, fontFamily: theme.font.body, fontWeight: 600, fontSize: Math.min(26 * scale, rowHeight * 0.44), color: theme.color.ink }}>
                {label}
              </div>
            ) : (
              <div style={bar(`${[62, 48, 56][index]}%`, rowHeight * 0.2, soft)} />
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        ...base,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16 * scale,
        borderRadius: theme.radius.panel,
        background: withAlpha(theme.color.slate300, 0.45),
        overflow: 'hidden',
      }}
    >
      <Icon name="image" size={Math.min(64 * scale, height * 0.5)} color="#64748b" strokeWidth={1.4} />
      {label ? (
        <div style={{ ...oneLine, maxWidth: '70%', fontFamily: theme.font.body, fontWeight: 600, fontSize: Math.min(26 * scale, height * 0.3), color: theme.color.slate600 }}>
          {label}
        </div>
      ) : null}
    </div>
  );
};
