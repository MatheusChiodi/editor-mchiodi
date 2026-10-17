// Motion blur: a 30 fps, um objeto que anda 80 px por frame sem borrão vira uma sequência de carimbos (parece
// barato). Duas técnicas, escolha pela situação:
//  1. subframes (`<MotionBlur>`): renderiza o MESMO conteúdo em N instantes dentro do obturador e soma. É o borrão
//     verdadeiro (curvas, rotação, escala). Custa N vezes o conteúdo: use só no que se move e só enquanto se move.
//  2. direcional (`<Smear>`): um desfoque gaussiano de um eixo, girado na direção da velocidade. Custa um filtro
//     pequeno; serve para translação reta de elemento pequeno ou médio.

export interface ShutterOptions {
  /** quantas amostras somar (4 = leve, 8 = padrão de entrega, 12 = herói lento em tela cheia) */
  samples?: number;
  /** ângulo do obturador em graus: 180 é o padrão de cinema (borra metade do deslocamento do frame) */
  shutterAngle?: number;
}

export interface ShutterSample {
  /** frame (fracionário) em que a amostra é avaliada */
  frame: number;
  /** peso na soma; os pesos somam 1 */
  weight: number;
}

/**
 * Instantes de amostragem dentro do obturador, centrados no frame: com 180° o obturador fica aberto
 * de `frame - 0,25` a `frame + 0,25`. Centrar evita que o borrão atrase o movimento em relação ao som.
 */
export function shutterSamples(frame: number, { samples = 8, shutterAngle = 180 }: ShutterOptions = {}): ShutterSample[] {
  const count = Math.max(1, Math.round(samples));
  if (count === 1) return [{ frame, weight: 1 }];
  const open = Math.max(0, shutterAngle) / 360;
  return Array.from({ length: count }, (_, index) => ({
    frame: frame + open * ((index + 0.5) / count - 0.5),
    weight: 1 / count,
  }));
}

/** Comprimento do borrão em px para uma velocidade em px por frame. */
export function blurLength(speedPerFrame: number, shutterAngle = 180): number {
  return Math.abs(speedPerFrame) * (Math.max(0, shutterAngle) / 360);
}

export interface AdaptiveOptions {
  /** teto de amostras */
  max?: number;
  /** distância máxima em px entre duas amostras vizinhas: acima disso aparecem "fantasmas" */
  spacing?: number;
  shutterAngle?: number;
  /** abaixo desta velocidade (px/frame) não há borrão: uma amostra só */
  threshold?: number;
}

/**
 * Quantas amostras este frame precisa: nenhuma parado, poucas devagar, o teto no pico. É o que mantém o custo
 * baixo, porque um movimento de mola passa a maior parte do tempo quase parado.
 */
export function adaptiveSamples(speedPerFrame: number, { max = 10, spacing = 5, shutterAngle = 180, threshold = 3 }: AdaptiveOptions = {}): number {
  const speed = Math.abs(speedPerFrame);
  if (speed < threshold) return 1;
  return Math.max(2, Math.min(max, Math.ceil(blurLength(speed, shutterAngle) / spacing) + 1));
}

export interface Vec2 {
  x: number;
  y: number;
}

/** Velocidade (px/frame) e direção (graus, 0 = para a direita, 90 = para baixo) entre duas posições vizinhas. */
export function velocity2D(previous: Vec2, next: Vec2, frames = 1): { x: number; y: number; speed: number; angle: number } {
  const x = (next.x - previous.x) / frames;
  const y = (next.y - previous.y) / frames;
  return { x, y, speed: Math.hypot(x, y), angle: (Math.atan2(y, x) * 180) / Math.PI };
}

export interface SmearSpec {
  /** rotação que alinha o eixo X com o movimento */
  angle: number;
  /** desvio padrão do desfoque gaussiano ao longo do movimento, em px */
  deviation: number;
  active: boolean;
}

/**
 * Parâmetros do borrão direcional. Um gaussiano de desvio σ espalha ~3,5σ: para cobrir o comprimento do
 * borrão, σ = comprimento / 3,5. Teto de 40 px: acima disso o elemento some em vez de borrar.
 */
export function smearSpec(velocity: Vec2, { shutterAngle = 180, strength = 1, max = 40, threshold = 3 }: { shutterAngle?: number; strength?: number; max?: number; threshold?: number } = {}): SmearSpec {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed < threshold) return { angle: 0, deviation: 0, active: false };
  const deviation = Math.min(max, (blurLength(speed, shutterAngle) * strength) / 3.5);
  return { angle: (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI, deviation: Math.round(deviation * 100) / 100, active: deviation >= 0.3 };
}
