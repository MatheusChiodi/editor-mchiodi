import { useId } from 'react';
import { Freeze, useCurrentFrame } from 'remotion';

import { adaptiveSamples, blurLength, shutterSamples, smearSpec, type Vec2 } from './blur';

export interface MotionBlurProps {
  /** teto de amostras (padrão 8). Com `speed`, o número real é adaptado quadro a quadro */
  samples?: number;
  /** ângulo do obturador (180 = cinema) */
  shutterAngle?: number;
  /**
   * velocidade do conteúdo neste frame, em px/frame (use `velocityAt`). Com ela o borrão só custa enquanto há
   * movimento: parado, o conteúdo é renderizado uma vez. Sem ela, usa sempre `samples`.
   */
  speed?: number;
  /**
   * velocidade em px/frame nos dois eixos (alternativa a `speed`). Com ela cada amostra ainda ganha um borrão
   * direcional curto, do tamanho do vão entre amostras: some o "pente" que aparece em texto e bordas finas quando
   * o movimento é reto e muito rápido. Custa um filtro por amostra: use em translação, não em tela cheia parada.
   */
  velocity?: Vec2;
  /**
   * Conteúdo. Nó React: os filhos são congelados em cada subframe (`useCurrentFrame()` deles devolve o subframe).
   * Função: recebe o subframe e devolve o nó (mais barato e explícito quando a posição é calculada aqui fora).
   */
  children: React.ReactNode | ((frame: number) => React.ReactNode);
  style?: React.CSSProperties;
}

/**
 * Motion blur verdadeiro por subframes. Envolva SÓ o que se move depressa.
 *
 * @example
 * const x = (f: number) => cineSpring(f, fps, { from: -900, to: 0, spring: 'pesada' });
 * <MotionBlur speed={velocityAt(x, frame)}>
 *   {(f) => <Card style={{ translate: `${x(f)}px 0` }} />}
 * </MotionBlur>
 */
export const MotionBlur: React.FC<MotionBlurProps> = ({ samples = 8, shutterAngle = 180, speed, velocity, children, style }) => {
  const frame = useCurrentFrame();
  const id = `cine-mb-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const pace = velocity ? Math.hypot(velocity.x, velocity.y) : speed;
  const count = pace === undefined ? samples : adaptiveSamples(pace, { max: samples, shutterAngle });
  const render = (at: number): React.ReactNode => (typeof children === 'function' ? children(at) : <Freeze frame={at}>{children}</Freeze>);
  if (count <= 1) return <div style={{ position: 'absolute', inset: 0, ...style }}>{typeof children === 'function' ? children(frame) : children}</div>;
  // preenche o vão entre duas amostras vizinhas (σ ≈ meio vão)
  const gap = velocity && pace ? blurLength(pace, shutterAngle) / count / 2 : 0;
  const angle = velocity ? (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI : 0;
  const fill = gap >= 0.6;
  return (
    // `isolate` + `plus-lighter`: as amostras somam (média exata), em vez de se cobrirem
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate', ...style }}>
      {fill ? (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${Math.min(12, gap).toFixed(2)} 0`} />
          </filter>
        </svg>
      ) : null}
      {shutterSamples(frame, { samples: count, shutterAngle }).map((sample, index) => (
        <div key={index} style={{ position: 'absolute', inset: 0, mixBlendMode: 'plus-lighter', opacity: sample.weight, ...(fill ? { rotate: `${angle}deg`, filter: `url(#${id})` } : null) }}>
          {fill ? <div style={{ position: 'absolute', inset: 0, rotate: `${-angle}deg` }}>{render(sample.frame)}</div> : render(sample.frame)}
        </div>
      ))}
    </div>
  );
};

export interface SmearProps {
  /** velocidade em px/frame nos dois eixos */
  velocity: Vec2;
  /** multiplica o comprimento do borrão (1 = físico) */
  strength?: number;
  shutterAngle?: number;
  /** teto do desvio do desfoque, em px */
  max?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Borrão direcional barato: um desfoque de um eixo girado na direção do movimento. Para translação reta de
 * elementos pequenos e médios (pílula, palavra, cartão). Não borra rotação nem escala: aí é `<MotionBlur>`.
 *
 * @example
 * <Smear velocity={{ x: velocityAt(x, frame), y: 0 }}><Pill /></Smear>
 */
export const Smear: React.FC<SmearProps> = ({ velocity, strength = 1, shutterAngle = 180, max = 40, children, style }) => {
  const id = `cine-smear-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const spec = smearSpec(velocity, { strength, shutterAngle, max });
  if (!spec.active) return <div style={style}>{children}</div>;
  return (
    <div style={{ ...style, rotate: `${spec.angle}deg`, filter: `url(#${id})` }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id={id} x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${spec.deviation} 0`} />
        </filter>
      </svg>
      <div style={{ rotate: `${-spec.angle}deg` }}>{children}</div>
    </div>
  );
};
