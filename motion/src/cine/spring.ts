// Física do kit: mola amortecida resolvida em forma fechada (sem simulação passo a passo), então o valor de
// qualquer frame, inteiro ou fracionário, sai direto. É isso que permite o motion blur por subframes.

export interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
}

/**
 * As quatro molas do canal. Escolha pelo PESO do que se move, não pelo gosto:
 * - `suave`: sem ultrapassar; texto, luz, câmera, tudo que só precisa chegar com elegância.
 * - `firme`: chega rápido e acomoda com um fio de overshoot (~1%); cartões, pílulas, troca de layout.
 * - `elastica`: overshoot visível e curto (~8%); UM destaque por plano (carimbo, número, selo).
 * - `pesada`: massa grande, parte devagar e assenta sem quicar; folhas grandes, o footage, a câmera em dolly.
 */
export const SPRINGS = {
  suave: { mass: 1, stiffness: 120, damping: 26 },
  firme: { mass: 1, stiffness: 260, damping: 26 },
  elastica: { mass: 1, stiffness: 220, damping: 18.7 },
  pesada: { mass: 3, stiffness: 180, damping: 44 },
} as const satisfies Record<string, SpringConfig>;

export type SpringPreset = keyof typeof SPRINGS;
export type SpringInput = SpringPreset | SpringConfig;

export function springConfig(input: SpringInput): SpringConfig {
  return typeof input === 'string' ? SPRINGS[input] : input;
}

/** Posição de uma mola que parte de 0 em repouso (ou com `velocity`, em unidades/s) rumo a 1, no instante `t` (s). */
export function springValue(t: number, input: SpringInput = 'firme', velocity = 0): number {
  if (t <= 0) return 0;
  const { mass, stiffness, damping } = springConfig(input);
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1 - 1e-6) {
    const damped = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) * (Math.cos(damped * t) + ((zeta * omega - velocity) / damped) * Math.sin(damped * t));
  }
  if (zeta <= 1 + 1e-6) return 1 - Math.exp(-omega * t) * (1 + (omega - velocity) * t);
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega * (zeta - root);
  const r2 = -omega * (zeta + root);
  const c1 = (velocity + r2) / (r1 - r2);
  return 1 + c1 * Math.exp(r1 * t) + (-1 - c1) * Math.exp(r2 * t);
}

/** Velocidade da mola (unidades por segundo) no instante `t`. */
export function springVelocity(t: number, input: SpringInput = 'firme'): number {
  const step = 1 / 2000;
  return (springValue(t + step, input) - springValue(Math.max(0, t - step), input)) / (t < step ? t + step : 2 * step);
}

/** Quanto a mola passa do alvo, em fração do percurso (0 = não ultrapassa). */
export function springOvershoot(input: SpringInput): number {
  const { mass, stiffness, damping } = springConfig(input);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  return zeta >= 1 ? 0 : Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));
}

/** Segundos até a mola ficar a menos de `tolerance` do alvo e não sair mais: é a duração real do movimento. */
export function settleTime(input: SpringInput, tolerance = 0.002): number {
  const step = 1 / 240;
  let last = 0;
  for (let t = 0; t <= 6; t += step) {
    if (Math.abs(1 - springValue(t, input)) > tolerance) last = t;
  }
  return Math.round((last + step) * 1000) / 1000;
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export interface AnticipationOptions {
  /** recuo antes de partir, em fração do percurso (0,03–0,08) */
  amount: number;
  /** quanto dura o recuo, em segundos (0,10–0,18) */
  seconds: number;
}

export interface CineSpringOptions {
  /** frame em que o movimento começa (a antecipação, se houver, começa aqui) */
  delay?: number;
  spring?: SpringInput;
  from?: number;
  to?: number;
  /** recua um pouco antes de partir: dá intenção ao movimento de objeto com peso */
  anticipation?: AnticipationOptions | false;
}

/** Recuo padrão: 5% do percurso em 4 frames. */
export const ANTICIPATION: AnticipationOptions = { amount: 0.05, seconds: 0.13 };

/** Progresso 0→1 (pode passar de 1 no overshoot e ficar negativo na antecipação). `frame` pode ser fracionário. */
export function springProgress(frame: number, fps: number, { delay = 0, spring = 'firme', anticipation = false }: Omit<CineSpringOptions, 'from' | 'to'> = {}): number {
  const t = (frame - delay) / fps;
  if (t <= 0) return 0;
  if (!anticipation) return springValue(t, spring);
  const { amount, seconds } = anticipation;
  if (t < seconds) return -amount * smoothstep(t / seconds);
  return -amount + (1 + amount) * springValue(t - seconds, spring);
}

/** Valor animado por mola entre `from` e `to`. É a função que os componentes usam no dia a dia. */
export function cineSpring(frame: number, fps: number, options: CineSpringOptions = {}): number {
  const { from = 0, to = 1 } = options;
  return from + (to - from) * springProgress(frame, fps, options);
}

/** Velocidade de um valor animado, em unidades por FRAME (diferença central): alimenta blur, arrasto e sombra. */
export function velocityAt(value: (frame: number) => number, frame: number, span = 0.5): number {
  return (value(frame + span) - value(frame - span)) / (2 * span);
}

/**
 * Saída 0→1 de quem "vai para algum lugar": recua `recoil` (toma impulso) e acelera até sumir.
 * Use com deslocamento + blur; nunca só com opacidade.
 */
export function departure(frame: number, fps: number, { start = 0, seconds = 0.3, recoil = 0.06 }: { start?: number; seconds?: number; recoil?: number } = {}): number {
  const t = Math.min(1, Math.max(0, (frame - start) / (seconds * fps)));
  // easeInBack com o recuo pedido: s é o parâmetro de Penner que produz um mínimo de -recoil
  const s = recoilToBack(recoil);
  return t * t * ((s + 1) * t - s);
}

function recoilToBack(recoil: number): number {
  if (recoil <= 0) return 0;
  // mínimo de t²((s+1)t - s) vale -4s³/(27(s+1)²); resolve por bisseção
  let low = 0;
  let high = 6;
  for (let step = 0; step < 40; step += 1) {
    const mid = (low + high) / 2;
    if ((4 * mid ** 3) / (27 * (mid + 1) ** 2) < recoil) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * Movimento secundário: o que está pendurado no objeto principal chega atrasado. Avalie o MESMO movimento
 * alguns frames antes (`lagFrames`) para a parte que arrasta (sombra, rótulo, enfeite).
 */
export function follow(value: (frame: number) => number, frame: number, lagFrames: number): number {
  return value(frame - lagFrames);
}

/**
 * Arrasto: inclinação (graus) ou esticada proporcional à velocidade, com teto. Um cartão que cruza a tela
 * inclina contra o movimento e endireita ao parar.
 */
export function drag(velocityPerFrame: number, { factor = 0.12, max = 6 }: { factor?: number; max?: number } = {}): number {
  const value = -velocityPerFrame * factor;
  return Math.max(-max, Math.min(max, value));
}

/** Esticada e achatada (squash & stretch) na direção do movimento, conservando área. Sutil: teto de 6%. */
export function stretch(speedPerFrame: number, { factor = 0.0012, max = 0.06 }: { factor?: number; max?: number } = {}): { along: number; across: number } {
  const amount = Math.min(max, Math.abs(speedPerFrame) * factor);
  return { along: 1 + amount, across: 1 / (1 + amount) };
}
