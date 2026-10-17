import type { BaseProps } from '../anim';
import type { ComponentEntry } from './registry';
import { TechRow, type TechRowProps } from './TechRow';

export type TechStackProps = Omit<TechRowProps, 'layout' | 'variant' | 'labels'>;

/** A mesma fileira do `TechRow`, empilhada num lado da tela: deixa o rosto livre quando a lista é longa. */
export const TechStack: React.FC<TechStackProps & BaseProps> = (props) => <TechRow {...props} layout="stack" variant="chip" />;

export const entry: ComponentEntry = {
  component: TechStack,
  sample: {
    title: 'O que eu uso',
    items: ['vscode', 'git', 'github', 'docker', 'vercel'],
    revealAt: [0.4, 1.2, 2, 2.8, 3.6],
    side: 'left',
    position: 'middle',
  },
  defaultDuration: 6,
  description:
    'Pilha vertical de tecnologias (ícone + nome em pílula) num lado da tela, uma por vez conforme a fala; a versão do `TechRow` para lista longa sobre o talking head.',
};
