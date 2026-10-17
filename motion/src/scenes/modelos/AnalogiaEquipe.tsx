// MODELO de animação reutilizável: na EDL entra como `scene:modelos/AnalogiaEquipe`, em qualquer vídeo.
//
// Analogia "uma liga / guilda / tripulação / time de <papéis>": de 2 a 6 membros em formação, cada um com o papel e o
// poder, sob o emblema do universo. O universo vem da prop `theme` (motion/src/themes); sem ela, estilo padrão do canal.

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { enter } from '../../scene-kit';
import { ThemeTitle } from '../../themes';
import { revealTimes } from '../../themes/shared/math';
import { type AnalogyBaseProps, AnalogyStage, Plaque } from '../../themes/shared/model';
import type { Actor } from '../../themes/types';
import { theme as brand } from '../../theme';

export interface AnalogiaEquipeMember {
  /** o papel real (conteúdo): "Front-end" */
  role: string;
  /** o poder, a especialidade: linha de apoio */
  power?: string;
  /** o papel no universo, na fonte de apoio: "o estrategista" */
  alias?: string;
}

export interface AnalogiaEquipeProps extends AnalogyBaseProps {
  /** de 2 a 6 membros, na ordem da fala */
  members?: AnalogiaEquipeMember[];
  /** segundo em que cada membro entra, por índice; os que faltam seguem em sequência */
  revealAt?: number[];
  /** segundo em que o emblema do universo acende atrás da equipe */
  emblemAt?: number;
}

export const MAX_MEMBERS = 6;

const DEFAULT_MEMBERS: AnalogiaEquipeMember[] = [{ role: 'Primeiro papel' }, { role: 'Segundo papel' }, { role: 'Terceiro papel' }];

export interface AnalogiaEquipeSlot {
  x: number;
  /** base da figura: quem está na ponta fica um pouco atrás (mais alto no quadro) */
  y: number;
  h: number;
  /** largura da plaqueta */
  plaque: number;
  /** variação do desenho: o centro da formação recebe o primeiro arquétipo */
  variant: number;
}

export interface AnalogiaEquipeLayout {
  ground: number;
  slots: AnalogiaEquipeSlot[];
  emblem: { x: number; y: number; h: number };
  /** topo das plaquetas */
  plaqueY: number;
}

/** Formação em V: o centro mais perto (maior), as pontas recuadas; o emblema acende atrás de quem está no centro. */
export function analogiaEquipeLayout(count: number): AnalogiaEquipeLayout {
  const n = Math.max(1, Math.min(MAX_MEMBERS, count));
  const ground = 756;
  const step = Math.min(330, 1700 / n);
  const middle = (n - 1) / 2;
  // quem fica mais perto do centro recebe o arquétipo 0 (o "líder"); os demais se alternam para fora
  const order = Array.from({ length: n }, (_, index) => index).sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || a - b);
  const slots = Array.from({ length: n }, (_, index) => {
    const spread = middle === 0 ? 0 : Math.abs(index - middle) / middle;
    return {
      x: 960 + (index - middle) * step,
      y: ground - spread * 22,
      h: 410 - spread * 54,
      plaque: Math.min(300, step - 18),
      variant: order.indexOf(index),
    };
  });
  return { ground, slots, emblem: { x: 960, y: 560, h: 300 }, plaqueY: ground + 16 };
}

export const AnalogiaEquipe: React.FC<AnalogiaEquipeProps & BaseProps> = ({
  theme: themeId,
  eyebrow,
  title = 'Uma equipe em que cada um tem o seu poder.',
  accent,
  intensity,
  members = DEFAULT_MEMBERS,
  revealAt,
  emblemAt = 0.4,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = members.slice(0, MAX_MEMBERS);
  const times = revealTimes(shown.length, revealAt, 1.1, 0.45);
  const layout = analogiaEquipeLayout(shown.length);

  const actors: Actor[] = [
    { id: 'emblem', kind: 'emblem', ...layout.emblem, progress: enter(frame, fps, emblemAt, 0.9) },
    ...layout.slots.map((slot, index): Actor => ({ id: `m${index}`, kind: 'member', x: slot.x, y: slot.y, h: slot.h, variant: slot.variant, progress: enter(frame, fps, times[index]!, 0.55) })),
  ];

  return (
    <AnalogyStage themeId={themeId} actors={actors} ground={layout.ground} intensity={intensity} durationInFrames={durationInFrames}>
      {(theme) => (
        <>
          <ThemeTitle theme={theme} title={title} accent={accent} eyebrow={eyebrow} fontSize={70} align="center" maxWidth={1560} style={{ position: 'absolute', left: (1920 - 1560) / 2, width: 1560, top: brand.safe.y - 8 }} />
          {shown.map((member, index) => {
            const slot = layout.slots[index]!;
            return <Plaque key={index} theme={theme} x={slot.x} y={layout.plaqueY} width={slot.plaque} label={member.role} sub={member.alias} hint={member.power} progress={enter(frame, fps, times[index]! + 0.18)} labelSize={36} />;
          })}
        </>
      )}
    </AnalogyStage>
  );
};

export const entry: ComponentEntry = {
  component: AnalogiaEquipe,
  opaque: true,
  sample: {
    theme: 'batman',
    eyebrow: 'A comunidade',
    title: 'Uma liga da justiça formada por devs.',
    accent: 'liga da justiça',
    members: [
      { role: 'Front-end', power: 'interface' },
      { role: 'Back-end', power: 'regras e dados' },
      { role: 'Mobile', power: 'apps' },
      { role: 'Dados', power: 'análise' },
      { role: 'DevOps', power: 'entrega' },
    ],
    revealAt: [1.1, 1.5, 1.9, 2.3, 2.7],
    emblemAt: 0.4,
    intensity: 1,
  },
  defaultDuration: 6,
  description:
    'Quando a fala compara um grupo a uma EQUIPE de um universo ("uma liga da justiça de devs", "a nossa guilda", "os vingadores do time", "a tripulação"): de 2 a 6 membros em formação, cada um com papel e poder, sob o emblema do universo (prop `theme`).',
  tags: ['analogia', 'universo', 'equipe', 'time', 'tema', 'batman', 'minecraft', 'mario', 'matrix', 'star-wars', 'rpg'],
  origin: { project: 'analogias', date: '2026-10-12' },
  slots: [
    { name: 'theme', type: 'string?', description: 'universo da analogia (pnpm mce arsenal themes); sem valor, estilo padrão do canal' },
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do título, na fonte do universo' },
    { name: 'title', type: 'string', description: 'a frase da analogia' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral' },
    { name: 'members', type: '{ role: string; power?: string; alias?: string }[] (2 a 6)', description: 'cada membro: papel real, poder (linha de apoio) e apelido no universo' },
    { name: 'revealAt', type: 'number[]', description: 'segundo em que cada membro entra, por índice' },
    { name: 'emblemAt', type: 'number?', description: 'segundo em que o emblema do universo acende atrás da equipe' },
    { name: 'intensity', type: 'number? (0–1)', description: 'quanto de atmosfera do universo entra; ~0.4 no tom sóbrio' },
  ],
};
