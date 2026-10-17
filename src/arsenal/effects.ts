export interface EffectContext {
  /** segundos do vídeo final */
  start: number;
  end: number;
  /** 0–1 */
  intensity: number;
  width: number;
  height: number;
  fps: number;
  /** 0–1 */
  focus: { x: number; y: number };
}

export type EffectCategory = 'look' | 'camera' | 'focus' | 'light' | 'glitch' | 'texture' | 'frame';

export interface EffectPreset {
  id: string;
  label: string;
  /** quando usar */
  description: string;
  kind: 'filter' | 'overlay';
  category: EffectCategory;
  /** só filter: filtros do ffmpeg já limitados ao intervalo */
  build?: (context: EffectContext) => string[];
  /** só overlay: variante do componente Fx e suas props */
  overlay?: { variant: string; props?: (intensity: number) => Record<string, unknown> };
  /** duração sugerida em segundos; null = pode valer para o vídeo inteiro */
  defaultDuration: number | null;
  defaultIntensity: number;
  tone: 'any' | 'sober' | 'playful';
}

type Rgb = [number, number, number];

/**
 * Cores do design system usadas nos looks. Cópia de `motion/src/theme.ts`, que não pode ser
 * importado pelo Node (carrega fontes do Remotion); o teste garante que as duas não divergem.
 */
export const BRAND = {
  ink: '#111827',
  coral: '#ff5555',
  paper: '#f8f8f2',
  night: '#0c0c0c',
  emerald: '#34d399',
  glowMint: '#9dffce',
} as const;

const fixed = (value: number) => Number(value.toFixed(3)).toString();
const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const lerp = (from: number, to: number, k: number) => from + (to - from) * k;
const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const span = (c: EffectContext) => Math.max(c.end - c.start, 1 / c.fps);
const between = (c: EffectContext) => `between(t,${fixed(c.start)},${fixed(c.end)})`;
const enable = (c: EffectContext) => `enable='${between(c)}'`;
const smooth = (p: string) => `(${p}*${p}*(3-2*${p}))`;
/** Progresso linear 0→1 dentro do intervalo. */
const progress = (c: EffectContext) => `clip((t-${fixed(c.start)})/${fixed(span(c))},0,1)`;

/** Envelope 0..1 em função de `t`: sobe e desce em smoothstep, zero fora do intervalo. */
export function envelope(c: EffectContext, rampIn = 0.4, rampOut = rampIn): string {
  const rin = Math.min(rampIn, span(c) / 3);
  const rout = Math.min(rampOut, span(c) / 3);
  const up = `clip((t-${fixed(c.start)})/${fixed(rin)},0,1)`;
  const down = `clip((t-${fixed(c.end - rout)})/${fixed(rout)},0,1)`;
  return `(${between(c)}*${smooth(up)}*(1-${smooth(down)}))`;
}

/**
 * Reenquadra sem mudar o tamanho do quadro: escala por frame e recorta de volta.
 * O recorte usa `t` e as dimensões fixas, porque o crop só reavalia `iw/ih` na configuração.
 * `fx`/`fy` (0–1) dizem que parte da sobra fica à esquerda/acima.
 */
function reframe(c: EffectContext, z: string, fx: string, fy: string): string[] {
  return [
    `scale=w='trunc(${c.width}*${z}/2)*2':h='trunc(${c.height}*${z}/2)*2':eval=frame:flags=bicubic`,
    `crop=${c.width}:${c.height}:x='${c.width}*(${z}-1)*${fx}':y='${c.height}*(${z}-1)*${fy}'`,
  ];
}

/** Rótulo único por efeito e instante: dois efeitos com sub-grafo podem conviver na mesma cadeia. */
const tag = (c: EffectContext, name: string) => `fx${name}${Math.round(c.start * 1000)}`;

/**
 * Camada tratada que entra e sai em fade sobre o original. É um sub-grafo de uma entrada e uma
 * saída, então continua valendo como um item da cadeia separada por vírgulas.
 */
function softLayer(c: EffectContext, name: string, filters: string[], mask: string[] | null = null, ramp = 0.3): string {
  const r = Math.min(ramp, span(c) / 3);
  const [a, b, m, k, l] = ['a', 'b', 'm', 'k', 'l'].map((part) => tag(c, name + part)) as [string, string, string, string, string];
  const fades = `fade=t=in:st=${fixed(c.start)}:d=${fixed(r)}:alpha=1,fade=t=out:st=${fixed(c.end - r)}:d=${fixed(r)}:alpha=1`;
  const merge = `[${a}][${l}]overlay=format=auto:enable='${between(c)}'`;
  if (!mask) return `split[${a}][${b}];[${b}]${filters.join(',')},format=yuva420p,${fades}[${l}];${merge}`;
  return [
    `split=3[${a}][${b}][${m}]`,
    `[${m}]${mask.join(',')}[${k}]`,
    `[${b}]${filters.join(',')}[${b}x]`,
    `[${b}x][${k}]alphamerge,${fades}[${l}]`,
    merge,
  ].join(';');
}

/** Máscara radial em cinza: preta no foco, branca nas bordas. `gain` endurece a transição. */
function edgeMask(c: EffectContext, gain: number): string[] {
  return [
    'format=gray',
    'lutyuv=y=255',
    `vignette=angle=PI/2:x0=${fixed(c.width * c.focus.x)}:y0=${fixed(c.height * c.focus.y)}`,
    'negate',
    `lutyuv=y='clip(val*${fixed(gain)},0,255)'`,
  ];
}

/** Retângulo (em pixels pares, dentro do quadro) centrado no foco. */
export function focusRegion(c: EffectContext, widthFraction: number, heightFraction: number) {
  const w = Math.min(even(c.width * widthFraction), even(c.width) - 2);
  const h = Math.min(even(c.height * heightFraction), even(c.height) - 2);
  const x = Math.round(Math.min(Math.max(c.width * c.focus.x - w / 2, 0), c.width - w));
  const y = Math.round(Math.min(Math.max(c.height * c.focus.y - h / 2, 0), c.height - h));
  return { x, y, w, h };
}

/** Curvas que levam um quadro em cinza a sombra → meio-tom → luz; `k` mistura com o cinza neutro. */
function tritone(k: number, shadow: Rgb, mid: Rgb, high: Rgb): string {
  const channel = (i: 0 | 1 | 2) =>
    `0/${fixed(lerp(0, shadow[i], k))} 0.5/${fixed(lerp(0.5, mid[i], k))} 1/${fixed(lerp(1, high[i], k))}`;
  return `r='${channel(0)}':g='${channel(1)}':b='${channel(2)}'`;
}

const balance = (values: Record<string, number>) =>
  `colorbalance=${Object.entries(values).map(([key, value]) => `${key}=${fixed(value)}`).join(':')}`;

/** Ruído suave e determinístico em [-1, 1]: duas senoides de frequências que não se alinham. */
const wobble = (f1: number, f2: number, phase: number) =>
  `((sin(2*PI*${fixed(f1)}*t+${fixed(phase)})+0.6*sin(2*PI*${fixed(f2)}*t+${fixed(phase * 2.3 + 1.3)}))/1.6)`;

type Build = (context: EffectContext, k: number) => string[];
type Meta = Pick<EffectPreset, 'label' | 'description' | 'defaultDuration' | 'defaultIntensity' | 'tone'>;

const filter = (id: string, category: EffectCategory, meta: Meta, build: Build): EffectPreset => ({
  id,
  category,
  kind: 'filter',
  ...meta,
  build: (context) => build(context, clamp01(context.intensity)),
});

const overlay = (id: string, category: EffectCategory, variant: string, meta: Meta): EffectPreset => ({
  id,
  category,
  kind: 'overlay',
  ...meta,
  overlay: { variant, props: (intensity) => ({ intensity: clamp01(intensity) }) },
});

const SEPIA = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const MIXER_KEYS = ['rr', 'rg', 'rb', 'gr', 'gg', 'gb', 'br', 'bg', 'bb'];

const presets: EffectPreset[] = [
  // ───────── look ─────────
  filter(
    'look-warm-editorial',
    'look',
    {
      label: 'Quente editorial',
      description: 'Trecho de conversa, história pessoal ou opinião: aquece a pele e aproxima do tom paper do site.',
      defaultDuration: null,
      defaultIntensity: 0.5,
      tone: 'any',
    },
    (c, k) => [
      `eq=contrast=${fixed(lerp(1.02, 1.08, k))}:saturation=${fixed(lerp(1.02, 1.1, k))}:${enable(c)}`,
      `${balance({ rm: lerp(0.02, 0.08, k), bm: lerp(-0.02, -0.08, k), rh: lerp(0.01, 0.05, k), bh: lerp(-0.02, -0.06, k) })}:${enable(c)}`,
    ],
  ),
  filter(
    'look-cool-tech',
    'look',
    {
      label: 'Frio técnico',
      description: 'Explicação técnica, arquitetura, terminal: imagem limpa e levemente azulada.',
      defaultDuration: null,
      defaultIntensity: 0.5,
      tone: 'any',
    },
    (c, k) => [
      `eq=contrast=${fixed(lerp(1.03, 1.1, k))}:saturation=${fixed(lerp(1, 0.9, k))}:${enable(c)}`,
      `${balance({ rm: lerp(-0.02, -0.07, k), bm: lerp(0.02, 0.08, k), bh: lerp(0.01, 0.05, k) })}:${enable(c)}`,
    ],
  ),
  filter(
    'look-mono',
    'look',
    {
      label: 'Preto e branco',
      description: 'Lembrança, citação séria ou "como era antes": tira a cor e sobe o contraste.',
      defaultDuration: 6,
      defaultIntensity: 0.5,
      tone: 'sober',
    },
    (c, k) => [`eq=saturation=0:contrast=${fixed(lerp(1.04, 1.24, k))}:${enable(c)}`],
  ),
  filter(
    'look-duotone-ink-coral',
    'look',
    {
      label: 'Duotone ink e coral',
      description: 'Abertura de capítulo ou momento de assinatura da marca: sombras em ink, meios-tons em coral, luzes em paper.',
      defaultDuration: 3,
      defaultIntensity: 0.6,
      tone: 'playful',
    },
    (c, k) => [
      `hue=s=0:${enable(c)}`,
      `curves=${tritone(lerp(0.35, 1, k), hexToRgb(BRAND.ink), hexToRgb(BRAND.coral), hexToRgb(BRAND.paper))}:${enable(c)}`,
    ],
  ),
  filter(
    'look-dramatic-desat',
    'look',
    {
      label: 'Dessaturado dramático',
      description: 'Erro que custou caro, alerta de segurança, virada séria: menos cor e mais contraste.',
      defaultDuration: 8,
      defaultIntensity: 0.5,
      tone: 'sober',
    },
    (c, k) => [
      `eq=saturation=${fixed(lerp(0.8, 0.4, k))}:contrast=${fixed(lerp(1.06, 1.24, k))}:gamma=${fixed(lerp(0.99, 0.92, k))}:${enable(c)}`,
      `${balance({ bs: lerp(0.01, 0.05, k), rs: lerp(-0.01, -0.03, k) })}:${enable(c)}`,
    ],
  ),
  filter(
    'look-night-contrast',
    'look',
    {
      label: 'Contraste noturno',
      description: 'Madrugada de deploy, incidente em produção, clima de investigação: escurece e esfria as sombras.',
      defaultDuration: 8,
      defaultIntensity: 0.5,
      tone: 'sober',
    },
    (c, k) => [
      `eq=brightness=${fixed(lerp(-0.02, -0.08, k))}:contrast=${fixed(lerp(1.08, 1.26, k))}:saturation=${fixed(lerp(0.92, 0.74, k))}:${enable(c)}`,
      `${balance({ bs: lerp(0.03, 0.1, k), rs: lerp(-0.02, -0.05, k), bm: lerp(0.01, 0.05, k) })}:${enable(c)}`,
    ],
  ),
  filter(
    'look-flashback',
    'look',
    {
      label: 'Flashback lavado',
      description: 'Volta no tempo ("quando eu comecei..."): pretos levantados, pouca cor, quente e levemente suave.',
      defaultDuration: 6,
      defaultIntensity: 0.5,
      tone: 'any',
    },
    (c, k) => [
      `curves=all='0/${fixed(lerp(0.03, 0.11, k))} 1/${fixed(lerp(0.99, 0.95, k))}':${enable(c)}`,
      `${balance({ rm: lerp(0.02, 0.07, k), bm: lerp(-0.02, -0.07, k) })}:${enable(c)}`,
      `eq=saturation=${fixed(lerp(0.8, 0.5, k))}:${enable(c)}`,
      `gblur=sigma=${fixed(lerp(0.5, 1.4, k))}:${enable(c)}`,
    ],
  ),
  filter(
    'look-vivid-demo',
    'look',
    {
      label: 'Vívido para demo',
      description: 'Mostrando o resultado funcionando ou um produto na tela: cores mais vivas sem estourar a pele.',
      defaultDuration: null,
      defaultIntensity: 0.4,
      tone: 'playful',
    },
    (c, k) => [
      `vibrance=intensity=${fixed(lerp(0.1, 0.4, k))}:${enable(c)}`,
      `eq=contrast=${fixed(lerp(1.02, 1.09, k))}:${enable(c)}`,
    ],
  ),
  filter(
    'look-matte-film',
    'look',
    {
      label: 'Matte de filme',
      description: 'Reflexão calma, encerramento, bastidores: pretos foscos e luzes contidas, ar de cinema discreto.',
      defaultDuration: null,
      defaultIntensity: 0.5,
      tone: 'any',
    },
    (c, k) => [
      `curves=all='0/${fixed(lerp(0.03, 0.11, k))} 0.5/0.5 1/${fixed(lerp(0.98, 0.93, k))}':${enable(c)}`,
      `eq=saturation=${fixed(lerp(0.97, 0.84, k))}:${enable(c)}`,
    ],
  ),
  filter(
    'look-split-tone-brand',
    'look',
    {
      label: 'Split-tone da marca',
      description: 'Gancho ou trecho de destaque: sombras puxadas para o periwinkle e luzes para o peach dos glows do site.',
      defaultDuration: null,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => [
      `${balance({
        rs: lerp(-0.03, -0.1, k), bs: lerp(0.03, 0.11, k),
        rh: lerp(0.03, 0.09, k), gh: lerp(0.01, 0.03, k), bh: lerp(-0.03, -0.09, k),
      })}:${enable(c)}`,
      `eq=contrast=${fixed(lerp(1.02, 1.08, k))}:${enable(c)}`,
    ],
  ),
  filter(
    'look-sepia-paper',
    'look',
    {
      label: 'Sépia paper',
      description: 'História da computação, foto antiga, citação de livro: sépia suave que conversa com o paper.',
      defaultDuration: 6,
      defaultIntensity: 0.5,
      tone: 'any',
    },
    (c, k) => {
      const mix = lerp(0.3, 0.85, k);
      const matrix = MIXER_KEYS.map((key, index) => `${key}=${fixed(lerp(IDENTITY[index]!, SEPIA[index]!, mix))}`).join(':');
      return [`colorchannelmixer=${matrix}:${enable(c)}`, `eq=contrast=${fixed(lerp(1, 0.94, k))}:${enable(c)}`];
    },
  ),
  filter(
    'look-emerald-terminal',
    'look',
    {
      label: 'Terminal esmeralda',
      description: 'Piada de "modo hacker" ou trecho dentro do terminal: monocromático em emerald, a cor de "funcionando".',
      defaultDuration: 3,
      defaultIntensity: 0.6,
      tone: 'playful',
    },
    (c, k) => [
      `hue=s=0:${enable(c)}`,
      `curves=${tritone(lerp(0.4, 1, k), hexToRgb(BRAND.night), hexToRgb(BRAND.emerald), hexToRgb(BRAND.glowMint))}:${enable(c)}`,
    ],
  ),

  // ───────── camera ─────────
  filter(
    'camera-punch-in',
    'camera',
    {
      label: 'Punch-in',
      description: 'Ênfase real: conclusão, "preste atenção nisso". Entra e sai com easing de 0.4s.',
      defaultDuration: 2.5,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => reframe(c, `(1+${fixed(lerp(0.06, 0.25, k))}*${envelope(c)})`, fixed(c.focus.x), fixed(c.focus.y)),
  ),
  filter(
    'camera-snap-zoom',
    'camera',
    {
      label: 'Snap zoom',
      description: 'Piada ou reação: o zoom chega em 0.1s e segura. Use no máximo uma vez por piada.',
      defaultDuration: 1.6,
      defaultIntensity: 0.5,
      tone: 'playful',
    },
    (c, k) => reframe(c, `(1+${fixed(lerp(0.1, 0.32, k))}*${envelope(c, 0.1, 0.14)})`, fixed(c.focus.x), fixed(c.focus.y)),
  ),
  filter(
    'camera-pull-out',
    'camera',
    {
      label: 'Pull-out',
      description: 'Começa fechado e abre desacelerando: revela o contexto depois de um detalhe. Comece num corte.',
      defaultDuration: 2.5,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => {
      const rest = `(1-${progress(c)})`;
      return reframe(c, `(1+${fixed(lerp(0.06, 0.24, k))}*${between(c)}*${rest}*${rest}*${rest})`, fixed(c.focus.x), fixed(c.focus.y));
    },
  ),
  filter(
    'camera-slow-push',
    'camera',
    {
      label: 'Push lento',
      description: 'Gancho investigativo ou raciocínio que cresce: aproxima devagar até o fim do trecho. Termine num corte.',
      defaultDuration: 6,
      defaultIntensity: 0.35,
      tone: 'sober',
    },
    (c, k) => reframe(c, `(1+${fixed(lerp(0.04, 0.16, k))}*${between(c)}*${progress(c)})`, fixed(c.focus.x), fixed(c.focus.y)),
  ),
  filter(
    'camera-pan-left',
    'camera',
    {
      label: 'Pan para a esquerda',
      description: 'Abre espaço à direita do quadro para um gráfico, ou acompanha o olhar para a esquerda.',
      defaultDuration: 3,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => reframe(c, `(1+${fixed(lerp(0.05, 0.14, k))}*${envelope(c)})`, `(0.85-0.7*${smooth(progress(c))})`, fixed(c.focus.y)),
  ),
  filter(
    'camera-pan-right',
    'camera',
    {
      label: 'Pan para a direita',
      description: 'Abre espaço à esquerda do quadro para um gráfico, ou acompanha o olhar para a direita.',
      defaultDuration: 3,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => reframe(c, `(1+${fixed(lerp(0.05, 0.14, k))}*${envelope(c)})`, `(0.15+0.7*${smooth(progress(c))})`, fixed(c.focus.y)),
  ),
  filter(
    'camera-tilt-up',
    'camera',
    {
      label: 'Tilt para cima',
      description: 'Sobe o enquadramento: do teclado/mesa para o rosto, ou para dar peso a uma revelação.',
      defaultDuration: 3,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => reframe(c, `(1+${fixed(lerp(0.05, 0.14, k))}*${envelope(c)})`, fixed(c.focus.x), `(0.85-0.7*${smooth(progress(c))})`),
  ),
  filter(
    'camera-impact-shake',
    'camera',
    {
      label: 'Tremor de impacto',
      description: 'Queda de servidor, "quebrou tudo", batida na mesa: tremor forte que morre em meio segundo.',
      defaultDuration: 0.6,
      defaultIntensity: 0.5,
      tone: 'playful',
    },
    (c, k) => {
      const decay = `(${between(c)}*clip((t-${fixed(c.start)})/0.04,0,1)*exp(-5*${progress(c)}))`;
      return reframe(c, `(1+${fixed(lerp(0.02, 0.07, k))}*${decay})`, `(0.5+0.5*${wobble(11, 17, 0.4)})`, `(0.5+0.5*${wobble(13, 19, 2.1)})`);
    },
  ),
  filter(
    'camera-handheld',
    'camera',
    {
      label: 'Câmera na mão',
      description: 'Bastidor, tensão leve ou trecho parado demais: balanço lento e quase imperceptível.',
      defaultDuration: 6,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) =>
      reframe(c, `(1+${fixed(lerp(0.02, 0.06, k))}*${envelope(c, 0.6)})`, `(0.5+0.5*${wobble(0.37, 0.83, 0.2)})`, `(0.5+0.5*${wobble(0.29, 0.71, 1.7)})`),
  ),
  filter(
    'camera-dutch-tilt',
    'camera',
    {
      label: 'Rotação sutil',
      description: 'Algo está errado ou estranho (bug misterioso, comportamento inesperado): inclina o quadro alguns graus.',
      defaultDuration: 3,
      defaultIntensity: 0.4,
      tone: 'playful',
    },
    (c, k) => {
      const angle = (lerp(0.6, 3, k) * Math.PI) / 180;
      const aspect = Math.max(c.width, c.height) / Math.min(c.width, c.height);
      const env = envelope(c);
      return [
        `rotate=a='${fixed(angle)}*${env}':c=black:bilinear=1`,
        // o zoom acompanha a rotação na medida exata para esconder os cantos pretos
        ...reframe(c, `(1+${fixed(angle * aspect * 1.2)}*${env})`, '0.5', '0.5'),
      ];
    },
  ),

  // ───────── focus ─────────
  filter(
    'focus-blur-all',
    'focus',
    {
      label: 'Desfoque geral',
      description: 'Tira a atenção do footage enquanto um cartão ou texto grande ocupa a tela.',
      defaultDuration: 4,
      defaultIntensity: 0.5,
      tone: 'any',
    },
    (c, k) => [softLayer(c, 'blurall', [`gblur=sigma=${fixed(lerp(6, 28, k) * (c.height / 1080))}:${enable(c)}`])],
  ),
  filter(
    'focus-blur-background',
    'focus',
    {
      label: 'Desfoque de fundo',
      description: 'Isola o rosto: nítido ao redor do foco e desfocado nas bordas, como lente clara. É aproximado (máscara radial).',
      defaultDuration: 4,
      defaultIntensity: 0.5,
      tone: 'any',
    },
    (c, k) => [
      softLayer(c, 'blurbg', [`gblur=sigma=${fixed(lerp(4, 16, k) * (c.height / 1080))}:${enable(c)}`], edgeMask(c, lerp(1.6, 2.6, k))),
    ],
  ),
  filter(
    'focus-pixelate-region',
    'focus',
    {
      label: 'Pixelar região',
      description: 'Censura dado sensível na tela (chave de API, e-mail, rosto de terceiro). A região é centrada no foco.',
      defaultDuration: 4,
      defaultIntensity: 0.6,
      tone: 'any',
    },
    (c, k) => {
      const area = focusRegion(c, 0.3, 0.3);
      const block = Math.max(4, Math.round((lerp(14, 48, k) * c.height) / 1080));
      const [a, b, p] = [tag(c, 'pixa'), tag(c, 'pixb'), tag(c, 'pixp')];
      return [
        `split[${a}][${b}];[${b}]crop=${area.w}:${area.h}:${area.x}:${area.y},pixelize=w=${block}:h=${block}[${p}];` +
          `[${a}][${p}]overlay=${area.x}:${area.y}:enable='${between(c)}'`,
      ];
    },
  ),
  filter(
    'focus-blur-region',
    'focus',
    {
      label: 'Desfocar região',
      description: 'Esconde algo sem chamar atenção (aba aberta, notificação, marca ao fundo). A região é centrada no foco.',
      defaultDuration: 4,
      defaultIntensity: 0.6,
      tone: 'any',
    },
    (c, k) => {
      const area = focusRegion(c, 0.3, 0.3);
      const feather = even(Math.min(area.w, area.h) * 0.14);
      const [a, b, s, m, k2, p] = ['a', 'b', 's', 'm', 'k', 'p'].map((part) => tag(c, `blr${part}`)) as [string, string, string, string, string, string];
      return [
        // máscara: retângulo branco borrado, para a borda da área desfocada não aparecer como caixa
        `split[${a}][${b}];[${b}]crop=${area.w}:${area.h}:${area.x}:${area.y},split[${s}][${m}];` +
          `[${m}]format=gray,lutyuv=y=0,drawbox=x=${feather}:y=${feather}:w=${area.w - feather * 2}:h=${area.h - feather * 2}:color=white:t=fill,gblur=sigma=${fixed(feather / 2.5)}[${k2}];` +
          `[${s}]gblur=sigma=${fixed(lerp(10, 36, k) * (c.height / 1080))}[${s}x];[${s}x][${k2}]alphamerge[${p}];` +
          `[${a}][${p}]overlay=${area.x}:${area.y}:format=auto:enable='${between(c)}'`,
      ];
    },
  ),
  overlay('focus-spotlight', 'focus', 'spotlight', {
    label: 'Holofote',
    description: 'Escurece tudo em volta de um ponto para o espectador olhar ali (rosto, objeto, linha da tela).',
    defaultDuration: 3,
    defaultIntensity: 0.5,
    tone: 'any',
  }),
  overlay('focus-dim-outside', 'focus', 'dim-rect', {
    label: 'Escurecer fora da área',
    description: 'Destaca um retângulo (janela, trecho de código na tela gravada) escurecendo o resto.',
    defaultDuration: 4,
    defaultIntensity: 0.5,
    tone: 'any',
  }),

  // ───────── light ─────────
  filter(
    'light-flash-white',
    'light',
    {
      label: 'Flash branco',
      description: 'Marca um instante único: foto, "eureca", troca de cenário. Um flash só, que decai; nunca em sequência.',
      defaultDuration: 0.5,
      defaultIntensity: 0.5,
      tone: 'playful',
    },
    (c, k) => {
      const decay = `(${between(c)}*clip((t-${fixed(c.start)})/0.05,0,1)*exp(-6*${progress(c)}))`;
      return [`eq=brightness='${fixed(lerp(0.2, 0.7, k))}*${decay}':eval=frame`];
    },
  ),
  filter(
    'light-exposure-pulse',
    'light',
    {
      label: 'Pulso de exposição',
      description: 'Ênfase suave numa palavra-chave sem mexer no enquadramento: a imagem clareia e volta.',
      defaultDuration: 1.2,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => {
      const bell = envelope(c, span(c) / 2);
      return [`eq=brightness='${fixed(lerp(0.03, 0.14, k))}*${bell}':contrast='1+${fixed(lerp(0.02, 0.08, k))}*${bell}':eval=frame`];
    },
  ),
  filter(
    'light-dip-black',
    'light',
    {
      label: 'Mergulho no preto',
      description: 'Passagem de tempo ou pausa dramática dentro do mesmo clipe: escurece e volta.',
      defaultDuration: 1.2,
      defaultIntensity: 1,
      tone: 'sober',
    },
    (c, k) => {
      const env = envelope(c, span(c) * 0.42);
      const depth = fixed(lerp(0.45, 1, k));
      return [`eq=brightness='-${depth}*${env}':saturation='1-${depth}*${env}':eval=frame`];
    },
  ),
  filter(
    'light-dip-white',
    'light',
    {
      label: 'Mergulho no branco',
      description: 'Lembrança, sonho ou virada otimista: clareia até quase branco e volta, devagar.',
      defaultDuration: 1.4,
      defaultIntensity: 0.8,
      tone: 'any',
    },
    (c, k) => {
      const env = envelope(c, span(c) * 0.42);
      const depth = fixed(lerp(0.4, 1, k));
      return [`eq=brightness='${depth}*${env}':saturation='1-${depth}*${env}':eval=frame`];
    },
  ),
  filter(
    'light-bloom',
    'light',
    {
      label: 'Bloom',
      description: 'Brilho suave nas luzes: momento de conquista, resultado final, tom de sonho.',
      defaultDuration: 4,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => {
      const [a, b, g] = [tag(c, 'blma'), tag(c, 'blmb'), tag(c, 'blmg')];
      return [
        // o screen só no luma: nos planos de croma ele distorceria as cores
        `format=yuv420p,split[${a}][${b}];[${b}]gblur=sigma=${fixed(lerp(14, 34, k) * (c.height / 1080))}:${enable(c)}[${g}];` +
          `[${a}][${g}]blend=c0_mode=screen:c0_opacity=${fixed(lerp(0.15, 0.5, k))}:c1_opacity=0:c2_opacity=0:${enable(c)}`,
      ];
    },
  ),
  overlay('light-leak-warm', 'light', 'light-leak', {
    label: 'Light leak quente',
    description: 'Vazamento de luz em peach e coral que atravessa o quadro: transição de assunto ou abertura calorosa.',
    defaultDuration: 1.6,
    defaultIntensity: 0.5,
    tone: 'any',
  }),

  // ───────── glitch ─────────
  filter(
    'glitch-rgb-split',
    'glitch',
    {
      label: 'Separação RGB',
      description: 'Contexto de bug, erro ou hack: os canais de cor se desalinham por um instante.',
      defaultDuration: 0.5,
      defaultIntensity: 0.5,
      tone: 'playful',
    },
    (c, k) => {
      const shift = Math.max(1, Math.round(c.width * lerp(0.002, 0.009, k)));
      return [`rgbashift=rh=${-shift}:bh=${shift}:gv=${Math.round(shift / 3)}:edge=smear:${enable(c)}`];
    },
  ),
  filter(
    'glitch-pixel-block',
    'glitch',
    {
      label: 'Bloco pixelado',
      description: 'Sinal ruim, "carregando em 144p", piada de baixa resolução: o quadro inteiro vira blocos.',
      defaultDuration: 0.6,
      defaultIntensity: 0.5,
      tone: 'playful',
    },
    (c, k) => {
      const block = Math.max(4, Math.round((lerp(10, 40, k) * c.height) / 1080));
      return [`pixelize=w=${block}:h=${block}:${enable(c)}`];
    },
  ),
  filter(
    'glitch-noise-burst',
    'glitch',
    {
      label: 'Rajada de ruído',
      description: 'Interferência: conexão caiu, câmera falhou, gravação corrompida.',
      defaultDuration: 0.5,
      defaultIntensity: 0.5,
      tone: 'playful',
    },
    (c, k) => [`noise=alls=${Math.round(lerp(18, 55, k))}:allf=t+u:${enable(c)}`, `eq=contrast=${fixed(lerp(1.04, 1.14, k))}:${enable(c)}`],
  ),
  filter(
    'glitch-h-shift',
    'glitch',
    {
      label: 'Deslocamento horizontal',
      description: 'Rasgo de sinal: duas faixas do quadro escorregam de lado. Só em contexto de erro/bug.',
      defaultDuration: 0.5,
      defaultIntensity: 0.5,
      tone: 'playful',
    },
    (c, k) => {
      const shift = Math.round(c.width * lerp(0.012, 0.05, k));
      const bandA = { y: even(c.height * 0.26), h: even(c.height * 0.09) };
      const bandB = { y: even(c.height * 0.58), h: even(c.height * 0.14) };
      // degraus de 1/8 s: o rasgo muda de posição sem piscar
      const step = (phase: number) => `(floor(mod(t*8+${phase},3))-1)`;
      const [a, b, d, p, q, m] = ['a', 'b', 'd', 'p', 'q', 'm'].map((part) => tag(c, `hsh${part}`)) as [string, string, string, string, string, string];
      return [
        `split=3[${a}][${b}][${d}];[${b}]crop=${c.width}:${bandA.h}:0:${bandA.y}[${p}];[${d}]crop=${c.width}:${bandB.h}:0:${bandB.y}[${q}];` +
          `[${a}][${p}]overlay=x='${shift}*${step(0)}':y=${bandA.y}:enable='${between(c)}'[${m}];` +
          `[${m}][${q}]overlay=x='${-Math.round(shift * 0.6)}*${step(1)}':y=${bandB.y}:enable='${between(c)}'`,
      ];
    },
  ),
  filter(
    'glitch-vhs',
    'glitch',
    {
      label: 'Fita VHS',
      description: 'Referência retrô (anos 90, tutorial antigo, "antigamente"): croma deslocado, ruído e imagem mole.',
      defaultDuration: 3,
      defaultIntensity: 0.5,
      tone: 'playful',
    },
    (c, k) => {
      const shift = Math.max(1, Math.round(c.width * lerp(0.002, 0.006, k)));
      return [
        `chromashift=cbh=${shift}:crh=${-shift}:${enable(c)}`,
        `gblur=sigma=${fixed(lerp(0.8, 2, k))}:sigmaV=0.3:${enable(c)}`,
        `noise=alls=${Math.round(lerp(6, 18, k))}:allf=t:${enable(c)}`,
        `eq=saturation=${fixed(lerp(0.95, 0.8, k))}:contrast=${fixed(lerp(1.02, 1.1, k))}:${enable(c)}`,
      ];
    },
  ),
  filter(
    'glitch-digital-burst',
    'glitch',
    {
      label: 'Pane digital',
      description: 'O momento em que o sistema quebra: três estágios rápidos (desalinha, vira bloco, desalinha ao contrário).',
      defaultDuration: 0.6,
      defaultIntensity: 0.5,
      tone: 'playful',
    },
    (c, k) => {
      const third = span(c) / 3;
      const stage = (index: number) => `enable='between(t,${fixed(c.start + third * index)},${fixed(index === 2 ? c.end : c.start + third * (index + 1))})'`;
      const shift = Math.max(1, Math.round(c.width * lerp(0.003, 0.01, k)));
      const block = Math.max(4, Math.round((lerp(8, 28, k) * c.height) / 1080));
      return [
        `rgbashift=rh=${shift}:bh=${-shift}:edge=smear:${stage(0)}`,
        `pixelize=w=${block * 2}:h=${block}:${stage(1)}`,
        `rgbashift=rh=${-shift * 2}:bh=${shift * 2}:edge=smear:${stage(1)}`,
        `rgbashift=rh=${-shift}:gh=${shift}:edge=smear:${stage(2)}`,
      ];
    },
  ),

  // ───────── texture ─────────
  filter(
    'texture-film-grain',
    'texture',
    {
      label: 'Grão de filme',
      description: 'Dá textura orgânica ao footage (e disfarça banding de câmera): grão só no luma, que muda a cada frame.',
      defaultDuration: null,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => [`noise=c0s=${Math.round(lerp(3, 14, k))}:c0f=t+u:${enable(c)}`],
  ),
  filter(
    'texture-vignette',
    'texture',
    {
      label: 'Vinheta',
      description: 'Escurece os cantos de leve e segura o olhar no centro; vale para o vídeo inteiro.',
      defaultDuration: null,
      defaultIntensity: 0.4,
      tone: 'any',
    },
    (c, k) => [`vignette=angle=${fixed(lerp(Math.PI / 10, Math.PI / 4, k))}:x0=${fixed(c.width * c.focus.x)}:y0=${fixed(c.height * c.focus.y)}:${enable(c)}`],
  ),
  overlay('texture-paper-grain', 'texture', 'grain', {
    label: 'Grão paper',
    description: 'O grão fractal do site por cima de tudo (footage e gráficos): unifica cenas ilustrativas com o talking head.',
    defaultDuration: null,
    defaultIntensity: 0.4,
    tone: 'any',
  }),
  overlay('texture-scanlines', 'texture', 'scanlines', {
    label: 'Scanlines',
    description: 'Monitor antigo/CRT: linhas horizontais finas, para trecho de terminal, retrô ou "dentro do computador".',
    defaultDuration: 4,
    defaultIntensity: 0.4,
    tone: 'playful',
  }),
  overlay('texture-vignette-ink', 'texture', 'vignette', {
    label: 'Vinheta ink animada',
    description: 'Vinheta em ink que fecha suavemente num momento sério ou íntimo e depois abre.',
    defaultDuration: 5,
    defaultIntensity: 0.5,
    tone: 'sober',
  }),

  // ───────── frame ─────────
  overlay('frame-letterbox', 'frame', 'letterbox', {
    label: 'Letterbox cinema',
    description: 'Barras de cinema que fecham em cima e embaixo: momento épico, história, referência de filme.',
    defaultDuration: 5,
    defaultIntensity: 0.6,
    tone: 'any',
  }),
  overlay('frame-paper', 'frame', 'paper-frame', {
    label: 'Moldura paper',
    description: 'Moldura clara com cantos arredondados: transforma o footage num "cartão" do site (depoimento, citação).',
    defaultDuration: 5,
    defaultIntensity: 0.5,
    tone: 'any',
  }),
  overlay('frame-side-bars', 'frame', 'side-bars', {
    label: 'Barras laterais',
    description: 'Fecha o quadro para perto de 4:3: gravação antiga, webcam, clima de arquivo.',
    defaultDuration: 5,
    defaultIntensity: 0.6,
    tone: 'any',
  }),
  overlay('frame-corner-marks', 'frame', 'corner-marks', {
    label: 'Marcas de canto',
    description: 'Cantoneiras finas de visor com um ponto coral: "gravando", bastidor, demonstração ao vivo.',
    defaultDuration: 5,
    defaultIntensity: 0.5,
    tone: 'any',
  }),
  overlay('frame-brand-glow', 'frame', 'brand-glow', {
    label: 'Glows da marca',
    description: 'Dois glows do site (mint no alto à esquerda, periwinkle embaixo à direita) emoldurando o quadro: abertura e encerramento.',
    defaultDuration: 6,
    defaultIntensity: 0.5,
    tone: 'any',
  }),
];

export const effects: Record<string, EffectPreset> = Object.fromEntries(presets.map((preset) => [preset.id, preset]));

/** Filtros de um preset `filter`; `[]` para overlay (que entra pela camada Remotion). */
export function buildEffectFilters(id: string, context: EffectContext): string[] {
  const preset = effects[id];
  if (!preset) throw new Error(`Efeito desconhecido: ${id}`);
  return preset.kind === 'filter' && preset.build ? preset.build(context) : [];
}
