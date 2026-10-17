import { type Tone, toneColors } from './tokens';

export interface SplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** 0→1: o divisor cresce a partir do centro */
  progress?: number;
  /** fração da largura ocupada pela metade esquerda */
  ratio?: number;
  gap?: number;
  divider?: boolean;
  tone?: Tone;
  style?: React.CSSProperties;
}

/** Larguras (em fração flex) das duas metades para um `ratio` entre 0 e 1. */
export function splitFlex(ratio: number): { left: number; right: number } {
  const left = Math.min(0.9, Math.max(0.1, ratio));
  return { left, right: 1 - left };
}

/** Duas metades lado a lado com um divisor fino: comparação, antes/depois, lado A e lado B. */
export const Split: React.FC<SplitProps> = ({ left, right, progress = 1, ratio = 0.5, gap = 64, divider = true, tone = 'paper', style }) => {
  const flex = splitFlex(ratio);
  const half: React.CSSProperties = { minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap, width: '100%', ...style }}>
      <div style={{ ...half, flex: flex.left }}>{left}</div>
      {divider ? <div style={{ width: 2, flexShrink: 0, background: toneColors(tone).hairline, scale: `1 ${progress}`, opacity: progress }} /> : null}
      <div style={{ ...half, flex: flex.right }}>{right}</div>
    </div>
  );
};
