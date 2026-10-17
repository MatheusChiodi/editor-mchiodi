// ESQUELETO de cena papel. Copie para motion/src/scenes/<projeto>/<Nome>.tsx (Nome em PascalCase),
// renomeie `SceneTemplate` e rode `pnpm mce scenes sync`. Esta pasta começa com `_`: o sync a ignora.
//
// Antes de escrever: qual é a ÚNICA ideia da fala? A cena mostra essa ideia e nada mais.
// Na EDL ela entra como `scene:<projeto>/<Nome>`, em tela cheia e opaca; a voz continua por baixo.
//
// ATENÇÃO: toda animação nova nasce como MODELO reutilizável (`pnpm mce scenes new <Nome>`, a partir de ModelTemplate.tsx).
// Cena sob medida é exceção, para a ideia que não se repete; e mesmo ela declara de qual modelo é instância,
// na raiz do arquivo, senão o `pnpm mce scenes audit` e a autoavaliação acusam "cena sem modelo":
//   export const MODEL = 'NomeDoModelo';

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { enter, IconBadge, Pill, Reveal, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';

export interface SceneTemplateProps {
  /**
   * Tempos em SEGUNDOS relativos ao início da cena. Cada elemento entra quando a fala o menciona:
   * o diretor tira os valores de `pnpm mce words <projeto> --from <s> --to <s>` (tempo da palavra menos o `at` do overlay).
   */
  revealAt?: { card: number; detail: number };
  title?: string;
  /** trecho do título em coral: o único acento da tela */
  accent?: string;
}

const DEFAULT_REVEAL = { card: 1.6, detail: 2.6 };

// Layout, contas de tempo e formatação vão em funções puras EXPORTADAS, testadas em tests/ (sem renderizar React).
export function templateColumns(count: number, width: number, gap = 32): number {
  return (width - gap * (count - 1)) / count;
}

export const SceneTemplate: React.FC<SceneTemplateProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  title = 'Uma ideia por cena.',
  accent = 'Uma ideia',
  durationInFrames,
}) => {
  // toda animação sai do frame: nada de CSS animation, Math.random(), Date ou setTimeout
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    // SceneBackground já dá papel + glows + grão, a margem segura, a faixa de 180 px livre para as legendas
    // e o fade de entrada/saída da cena inteira (por isso recebe durationInFrames)
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56 }}>
      {/* título em Playfair, palavra a palavra. Um eyebrow opcional situa o assunto */}
      <Statement text={title} accent={accent} eyebrow="Assunto" fontSize={96} />

      {/* primitivas com `progress` recebem enter(frame, fps, <segundo>): entram desacelerando, na ordem da fala */}
      <SceneCard progress={enter(frame, fps, revealAt.card)} style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <IconBadge icon="code" size={112} progress={enter(frame, fps, revealAt.card + 0.1)} />
        <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: text.body, color: theme.color.slate600 }}>Texto de apoio curto, nunca menor que 34 px.</div>
      </SceneCard>

      {/* Reveal embrulha qualquer filho que não tenha `progress` próprio */}
      <Reveal atSec={revealAt.detail}>
        <Pill variant="emerald" dot>
          emerald = funciona / certo
        </Pill>
      </Reveal>
    </SceneBackground>
  );
};

// `sample` é um exemplo real (alimenta o preview no Studio); `description` diz QUANDO usar a cena.
export const entry: ComponentEntry = {
  component: SceneTemplate,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 6,
  description: 'Esqueleto de cena papel: copie e adapte.',
};
