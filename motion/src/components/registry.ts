import type React from 'react';

import { entry as Fx } from '../arsenal/fx/Fx';
import { entry as Stinger } from '../arsenal/stingers/Stinger';
import { entry as BarChart } from './BarChart';
import { entry as BulletList } from './BulletList';
import { entry as Callout } from './Callout';
import { entry as CineShowcase } from './CineShowcase';
import { entry as CodeCard } from './CodeCard';
import { entry as Counter } from './Counter';
import { entry as Diagram } from './Diagram';
import { entry as DocQuote } from './DocQuote';
import { groupC1 } from './index-c1';
import { groupC2 } from './index-c2';
import { groupC3 } from './index-c3';
import { entry as Intro } from './Intro';
import { entry as LowerThird } from './LowerThird';
import { entry as MemeInsert } from './MemeInsert';
import { entry as Outro } from './Outro';
import { entry as PhraseReveal } from './PhraseReveal';
import { entry as PillStack } from './PillStack';
import { entry as ScreenFocus } from './ScreenFocus';
import { entry as SectionTitle } from './SectionTitle';
import { entry as SplitExplainer } from './SplitExplainer';
import { entry as StageProgress } from './StageProgress';
import { entry as SubscribeCTA } from './SubscribeCTA';
import { entry as TechBadge } from './TechBadge';
import { entry as TechRow } from './TechRow';
import { entry as TechStack } from './TechStack';
import { entry as TextReveal } from './TextReveal';
import { entry as WindowStage } from './WindowStage';

/** Uma prop de um modelo, descrita para o diretor preencher sem abrir o código. */
export interface ModelSlot {
  name: string;
  /** tipo em uma linha, como o diretor escreveria no JSON: `string`, `number[]`, `{ label: string; hint?: string }[]` */
  type: string;
  /** para que serve (o papel na tela, não o assunto de um vídeo) */
  description: string;
}

/** De que vídeo o modelo nasceu. */
export interface ModelOrigin {
  project: string;
  /** AAAA-MM-DD */
  date: string;
  /** cena sob medida de onde foi extraído, se houve uma */
  scene?: string;
}

export interface ComponentEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.FC<any>;
  /** props de exemplo: alimentam o preview no Studio e servem de documentação */
  sample: Record<string, unknown>;
  /** duração sugerida, em segundos */
  defaultDuration: number;
  description: string;
  /** pinta o quadro inteiro: num palco (`presenter`), dispensa o fundo de papel */
  opaque?: boolean;
  // Os três campos abaixo são dos MODELOS (motion/src/scenes/modelos/): o `mce arsenal models` os lê do fonte,
  // então escreva-os como literais (nada de valor calculado).
  /** forma da animação, para a busca: "lista", "comparação", "antes-depois", "ciclo", "linha do tempo"… */
  tags?: string[];
  origin?: ModelOrigin;
  /** uma linha por prop */
  slots?: ModelSlot[];
}

/**
 * Componentes que a EDL pode referenciar em `overlays[].component`.
 * Para criar um novo: arquivo em components/, registrar aqui com `sample`.
 */
export const registry: Record<string, ComponentEntry> = {
  LowerThird,
  SectionTitle,
  BulletList,
  Counter,
  BarChart,
  SubscribeCTA,
  CodeCard,
  Diagram,
  Callout,
  MemeInsert,
  Intro,
  Outro,
  TextReveal,
  ...groupC1,
  ...groupC2,
  ...groupC3,
  // linguagem do nível max (STYLE.md §0): pílulas, frase serifada e palcos com o apresentador em cartão
  PillStack,
  PhraseReveal,
  SplitExplainer,
  WindowStage,
  DocQuote,
  // ícones de tecnologia (motion/src/tech): toda tecnologia citada ganha ícone na primeira menção
  TechRow,
  TechStack,
  TechBadge,
  // foco na tela gravada e indicador que atravessa layouts (camada `persistent`)
  ScreenFocus,
  StageProgress,
  // padrão MChiodi Cinema (docs/cinema.md): cena de papel com profundidade, feita com o kit motion/src/cine
  CineShowcase,
  Stinger,
  Fx,
};
