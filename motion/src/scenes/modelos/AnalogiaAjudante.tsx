// MODELO de animação reutilizável: na EDL entra como `scene:modelos/AnalogiaAjudante`, em qualquer vídeo.
//
// Analogia "X era o meu <ajudante>" (o Alfred, a fada, o companheiro, o NPC guia): o ajudante do universo serve de 2 a 5
// itens ao herói. O universo vem da prop `theme` (motion/src/themes): o cenário e as figuras mudam, o layout é o mesmo.
// Sem `theme`, sai no estilo padrão do canal.

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { enter } from '../../scene-kit';
import { ThemePanel, ThemeTitle } from '../../themes';
import { revealTimes } from '../../themes/shared/math';
import { type AnalogyBaseProps, AnalogyStage, type Box, ItemCard, Plaque, rowBoxes } from '../../themes/shared/model';
import type { Actor } from '../../themes/types';
import { theme as brand } from '../../theme';

export interface AnalogiaAjudanteItem {
  label: string;
  /** linha de apoio, opcional */
  hint?: string;
  icon?: string;
}

export interface AnalogiaAjudanteProps extends AnalogyBaseProps {
  /** quem ajuda (conteúdo) e o papel dele no universo ("o meu Alfred") */
  helper?: { name: string; role?: string };
  /** quem é servido; sem nome, o herói aparece sem plaqueta */
  hero?: { name?: string; role?: string };
  /** de 2 a 5 itens servidos, na ordem da fala */
  items?: AnalogiaAjudanteItem[];
  /** segundo em que o ajudante entra */
  helperAt?: number;
  /** segundo (relativo ao início da cena) em que cada item é servido, por índice; os que faltam seguem em sequência */
  revealAt?: number[];
  /** frase de fecho, depois do último item */
  closing?: string;
  closingAt?: number;
}

export const MAX_ITEMS = 5;
const GAP = 22;

const DEFAULT_ITEMS: AnalogiaAjudanteItem[] = [
  { label: 'Primeiro item', icon: 'book' },
  { label: 'Segundo item', icon: 'flag' },
  { label: 'Terceiro item', icon: 'users' },
];

export interface AnalogiaAjudanteLayout {
  ground: number;
  helper: { x: number; h: number };
  hero: { x: number; h: number };
  /** o emblema do universo, no céu atrás do herói */
  emblem: { x: number; y: number; h: number };
  /** de onde os itens saem: a bandeja do ajudante */
  tray: { x: number; y: number };
  cards: Box[];
  rows: number;
}

/** Ajudante à esquerda, herói à direita e os itens no meio: uma fileira até 3, duas fileiras (3 + resto) com 4 ou 5. */
export function analogiaAjudanteLayout(count: number, hasHints = false): AnalogiaAjudanteLayout {
  const n = Math.max(1, Math.min(MAX_ITEMS, count));
  const ground = 800;
  const rows = n > 3 ? 2 : 1;
  const cardH = hasHints ? 196 : 164;
  const center = 1000;
  const cardW = n <= 2 ? 380 : 304;
  const first = rows === 2 ? 3 : n;
  const top = rows === 2 ? ground - 60 - cardH * 2 - GAP : ground - 150 - cardH;
  const cards = [...rowBoxes(first, center, top, cardW, cardH, GAP), ...(rows === 2 ? rowBoxes(n - first, center, top + cardH + GAP, cardW, cardH, GAP) : [])];
  return {
    ground,
    helper: { x: 292, h: 470 },
    hero: { x: 1668, h: 400 },
    emblem: { x: 1600, y: 500, h: 250 },
    tray: { x: 292 + 160, y: ground - 330 },
    cards,
    rows,
  };
}

export const AnalogiaAjudante: React.FC<AnalogiaAjudanteProps & BaseProps> = ({
  theme: themeId,
  eyebrow,
  title = 'Alguém que serve tudo o que você precisa.',
  accent,
  intensity,
  helper = { name: 'O ajudante' },
  hero,
  items = DEFAULT_ITEMS,
  helperAt = 0.5,
  revealAt,
  closing,
  closingAt,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = items.slice(0, MAX_ITEMS);
  const times = revealTimes(shown.length, revealAt, helperAt + 1.1, 0.6);
  const layout = analogiaAjudanteLayout(shown.length, shown.some((item) => item.hint));
  const lastSec = times.at(-1) ?? helperAt;
  const closeIn = enter(frame, fps, closingAt ?? lastSec + 0.8);

  const actors: Actor[] = [
    { id: 'emblem', kind: 'emblem', ...layout.emblem, progress: enter(frame, fps, 0.2, 0.8) },
    { id: 'helper', kind: 'helper', x: layout.helper.x, y: layout.ground, h: layout.helper.h, progress: enter(frame, fps, helperAt, 0.6) },
    { id: 'hero', kind: 'hero', x: layout.hero.x, y: layout.ground, h: layout.hero.h, flip: true, progress: enter(frame, fps, 0.15, 0.6) },
  ];

  return (
    <AnalogyStage themeId={themeId} actors={actors} ground={layout.ground} intensity={intensity} durationInFrames={durationInFrames}>
      {(theme) => (
        <>
          <ThemeTitle theme={theme} title={title} accent={accent} eyebrow={eyebrow} fontSize={76} maxWidth={1180} style={{ position: 'absolute', left: brand.safe.x, top: brand.safe.y }} />
          {shown.map((item, index) => (
            <ItemCard key={index} theme={theme} box={layout.cards[index]!} label={item.label} hint={item.hint} icon={item.icon} progress={enter(frame, fps, times[index]!, 0.55)} from={layout.tray} />
          ))}
          <Plaque theme={theme} x={layout.helper.x} y={layout.ground + 18} width={360} label={helper.name} sub={helper.role} progress={enter(frame, fps, helperAt + 0.25)} tone="primary" />
          {hero?.name ? <Plaque theme={theme} x={layout.hero.x} y={layout.ground + 18} width={300} label={hero.name} sub={hero.role} progress={enter(frame, fps, 0.5)} /> : null}
          {closing ? (
            <div style={{ position: 'absolute', left: 520, right: 440, top: layout.ground + 22, display: 'flex', justifyContent: 'center' }}>
              <ThemePanel theme={theme} tone="ok" progress={closeIn} style={{ padding: '12px 28px', fontFamily: brand.font.body, fontWeight: 600, fontSize: 34, lineHeight: 1.15 }}>
                {closing}
              </ThemePanel>
            </div>
          ) : null}
        </>
      )}
    </AnalogyStage>
  );
};

export const entry: ComponentEntry = {
  component: AnalogiaAjudante,
  opaque: true,
  sample: {
    theme: 'batman',
    eyebrow: 'Naquele tempo',
    title: 'A documentação era o meu Alfred.',
    accent: 'o meu Alfred',
    helper: { name: 'Documentação', role: 'o meu Alfred' },
    hero: { name: 'Eu', role: 'iniciante' },
    items: [
      { label: 'Exemplos', icon: 'code' },
      { label: 'Guias', icon: 'book' },
      { label: 'Referência', icon: 'file' },
      { label: 'Comunidade', icon: 'users' },
    ],
    helperAt: 0.5,
    revealAt: [1.8, 2.4, 3, 3.6],
    closing: 'tudo servido na hora',
    closingAt: 4.6,
    intensity: 1,
  },
  defaultDuration: 6.5,
  description:
    'Quando a fala compara alguém ou algo a um AJUDANTE de um universo ("X era o meu Alfred", "a minha fada madrinha", "o meu Yoda", "um NPC guia"): o ajudante daquele universo serve de 2 a 5 itens ao herói, no cenário do universo (prop `theme`).',
  tags: ['analogia', 'universo', 'ajudante', 'lista', 'tema', 'batman', 'minecraft', 'mario', 'matrix', 'star-wars', 'rpg'],
  origin: { project: 'analogias', date: '2026-10-12' },
  slots: [
    { name: 'theme', type: 'string?', description: 'universo da analogia (pnpm mce arsenal themes): batman, minecraft, mario, matrix, star-wars, rpg…; sem valor, estilo padrão do canal' },
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do título, na fonte do universo' },
    { name: 'title', type: 'string', description: 'a frase da analogia' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral' },
    { name: 'helper', type: '{ name: string; role?: string }', description: 'quem ajuda (nome real) e o papel no universo ("o meu Alfred")' },
    { name: 'hero', type: '{ name?: string; role?: string }?', description: 'quem é servido; sem nome, aparece sem plaqueta' },
    { name: 'items', type: '{ label: string; hint?: string; icon?: IconName }[] (2 a 5)', description: 'o que o ajudante serve, na ordem da fala' },
    { name: 'helperAt', type: 'number?', description: 'segundo em que o ajudante entra' },
    { name: 'revealAt', type: 'number[]', description: 'segundo em que cada item é servido, por índice' },
    { name: 'closing', type: 'string?', description: 'frase de fecho depois do último item' },
    { name: 'closingAt', type: 'number?', description: 'segundo em que o fecho entra' },
    { name: 'intensity', type: 'number? (0–1)', description: 'quanto de atmosfera do universo entra; ~0.4 no tom sóbrio' },
  ],
};
