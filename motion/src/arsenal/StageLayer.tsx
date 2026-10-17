import { createContext, useContext } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import { theme } from '../theme';
import { easeInOutQuad, holeAt, holePath, isWindowSlot, type OverlayWipe, type StagePlan, stageMotion, TEAR_SEC, tearPolygon } from './stage';

export interface StageLayerProps {
  stage?: StagePlan | null;
  wipe?: OverlayWipe;
  /** o componente já pinta o quadro inteiro: dispensa o fundo do palco */
  opaque?: boolean;
  durationInFrames: number;
  children: React.ReactNode;
}

export const BACKDROP = {
  paper: `radial-gradient(120% 90% at 25% 20%, ${theme.color.white} 0%, ${theme.color.paper} 55%, #efeee6 100%)`,
  night: theme.color.night,
};

export interface StageInfo {
  plan: StagePlan;
  durationInFrames: number;
  /**
   * Recorte (`clip-path`) do papel com o buraco deste frame. Só vem quando o próprio componente precisa aplicá-lo:
   * nos slots `window` de um componente opaco, que desenha destaques POR CIMA do footage (e por isso não pode
   * ser recortado inteiro pelo palco).
   */
  clip?: string;
}

const StageContext = createContext<StageInfo | null>(null);

/** O palco em que o componente está (slot do apresentador, vizinhos colados), ou null fora de um palco. */
export const useStage = (): StageInfo | null => useContext(StageContext);

/**
 * Envolve um overlay que mexe no quadro inteiro. Com `stage`, pinta o papel e recorta o buraco por onde
 * o footage (reenquadrado pelo ffmpeg no mesmo instante) aparece como cartão; com `wipe`, revela o
 * overlay por um rasgo de papel. Sem nenhum dos dois, não acrescenta nada.
 */
export const StageLayer: React.FC<StageLayerProps> = ({ stage, wipe = 'none', opaque = false, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  if (!stage && wipe === 'none') return <>{children}</>;

  const sec = frame / fps;
  const tear = wipe === 'tear' && sec < TEAR_SEC ? tearPolygon(easeInOutQuad(sec / TEAR_SEC)) : undefined;
  if (!stage) return <AbsoluteFill style={{ clipPath: tear }}>{children}</AbsoluteFill>;

  const hole = holeAt(stage, sec, durationInFrames / fps);
  const unit = height / 1080;
  const box = { left: hole.rect.x * width, top: hole.rect.y * height, width: hole.rect.w * width, height: hole.rect.h * height };
  const radii = hole.radii.map((value) => value * unit) as [number, number, number, number];
  // a moldura cresce com a troca: borda de 0 ao valor cheio, sombra junto
  const framed = hole.border / stageMotion.presenterCard.border;
  const tall = stage.slot === 'right' || stage.slot === 'left';
  const clip = `path(evenodd, "${holePath(width, height, [{ rect: hole.rect, radius: radii[2], radii }])}")`;
  // footage dentro da janela: o componente recorta o próprio papel e fica livre para desenhar sobre a tela
  const selfClipped = opaque && isWindowSlot(stage.slot);
  return (
    <StageContext.Provider value={{ plan: stage, durationInFrames, ...(selfClipped ? { clip } : {}) }}>
      <AbsoluteFill style={{ clipPath: tear }}>
        <AbsoluteFill style={{ clipPath: selfClipped ? undefined : clip }}>
          {!opaque && stage.backdrop !== 'none' ? <AbsoluteFill style={{ background: BACKDROP[stage.backdrop] }} /> : null}
          {children}
        </AbsoluteFill>
        {framed > 0.001 ? (
          <div
            style={{
              position: 'absolute',
              ...box,
              borderRadius: radii.map((value) => `${value}px`).join(' '),
              // borda em branco quente e sombra longa (medidas): o cartão se destaca do papel sem pintar nada por cima do rosto
              boxShadow: `0 0 0 ${hole.border * unit}px ${theme.color.paper}, 0 ${(tall ? 33 : 24) * unit}px ${72 * unit}px rgba(15,23,42,${(tall ? 0.3 : 0.35) * framed})`,
            }}
          />
        ) : null}
      </AbsoluteFill>
    </StageContext.Provider>
  );
};
