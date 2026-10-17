import type { Caption } from '@remotion/captions';

import type { OverlayWipe, StagePlan } from './arsenal/stage';

export type CaptionStyle = 'long' | 'shorts';

/** Caption do Remotion + marcação de palavra-chave. Tempos em ms do vídeo FINAL. */
export type StyledCaption = Caption & { highlight?: boolean };

export interface OverlayItem {
  id: string;
  component: string;
  /** frame de entrada no vídeo final */
  from: number;
  durationInFrames: number;
  props: Record<string, unknown>;
  hidesCaptions: boolean;
  /** palco: o footage vira um cartão e o componente desenha sobre papel (já ligado aos palcos vizinhos) */
  stage?: StagePlan | null;
  wipe?: OverlayWipe;
  /** `persistent`: camada fixa (indicador de progresso) desenhada por cima do gráfico da vez */
  layer?: 'base' | 'persistent';
}

/** Props da composição `Overlay`: tudo que vai por cima do footage, com fundo transparente. */
// `type` e não `interface`: o Remotion exige props atribuíveis a Record<string, unknown>
export type OverlayProps = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  captions: StyledCaption[];
  captionStyle: CaptionStyle;
  overlays: OverlayItem[];
};
