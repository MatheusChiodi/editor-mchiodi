// TEMPLATE: esqueleto de MODELO de animação. Não copie à mão: `pnpm mce scenes new <Nome> [--tags a,b] [--from <slug>/<Cena>]`
// TEMPLATE: grava motion/src/scenes/modelos/<Nome>.tsx a partir deste arquivo (troca o nome, as tags e a origem) e roda o sync.
// TEMPLATE: Esta pasta começa com `_`: o sync a ignora. As linhas `// TEMPLATE:` não vão para o modelo.
// MODELO de animação reutilizável: na EDL entra como `scene:modelos/ModelTemplate`, em qualquer vídeo.
//
// Contrato de um modelo (o `pnpm mce scenes audit` e os testes cobram):
// 1. 100% dirigido por props. Nenhum texto, número ou rótulo de um vídeo específico no código: tudo chega por prop,
//    com default NEUTRO (serve de exemplo, não de conteúdo).
// 2. Quantidade variável: a lista de itens é uma prop, e o layout se ajusta a N (função pura, testada).
// 3. Tempo por prop: `revealAt` por índice (lista) ou por chave (partes fixas), em segundos relativos ao início da cena.
// 4. `entry` com literais: `description` diz QUANDO usar (o tipo de fala), `tags` dizem a FORMA, `slots` descrevem cada prop,
//    `origin` diz de que vídeo nasceu e `sample` é um exemplo realista de OUTRO assunto qualquer.
// 5. O nome do arquivo descreve a forma (PilhaEmDoisGrupos, CicloDeDoisPassos, DegrauEVao), nunca o assunto.
//
// Prova de que é reutilizável: renderize com DOIS conjuntos de props (o do vídeo atual e um de outro assunto).

import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { enter, IconBadge, type IconName, Pill, Reveal, SceneBackground, SceneCard, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';

export interface ModelTemplateItem {
  label: string;
  /** linha de apoio, opcional */
  hint?: string;
  icon?: IconName;
}

export interface ModelTemplateProps {
  eyebrow?: string;
  title?: string;
  /** trecho do título em coral: o único acento da tela */
  accent?: string;
  /** de 2 a 5 itens; o layout divide a largura entre eles */
  items?: ModelTemplateItem[];
  /**
   * Segundo (relativo ao início da cena) em que cada item entra, por ÍNDICE: o diretor tira de
   * `pnpm mce words <projeto> --from <s> --to <s>` (tempo da palavra menos o `at` do overlay).
   * Índices que faltarem entram em sequência depois do último informado.
   */
  revealAt?: number[];
  /** pílula de fecho, depois do último item (omitida = não aparece) */
  closing?: string;
  closingAt?: number;
}

export const MAX_ITEMS = 5;
const GAP = 32;

// Defaults neutros: mostram a forma, não um assunto.
const DEFAULT_ITEMS: ModelTemplateItem[] = [
  { label: 'Primeiro', hint: 'o ponto de partida', icon: 'bolt' },
  { label: 'Segundo', hint: 'o que vem depois', icon: 'gear' },
  { label: 'Terceiro', hint: 'onde isso chega', icon: 'check' },
];

// Layout, contas de tempo e formatação vão em funções puras EXPORTADAS, testadas em tests/ (sem renderizar React).

/** Largura de cada cartão para `count` itens lado a lado. */
export function modelTemplateColumnWidth(count: number, width: number, gap = GAP): number {
  const columns = Math.max(1, Math.min(MAX_ITEMS, count));
  return Math.floor((width - gap * (columns - 1)) / columns);
}

/** Tempo de entrada de cada item: o que veio em `revealAt`, e os que faltam em sequência depois do último. */
export function modelTemplateTimes(count: number, revealAt: number[] = [], firstSec = 1.2, staggerSec = 0.7): number[] {
  const times: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const given = revealAt[index];
    times.push(typeof given === 'number' && Number.isFinite(given) ? given : index === 0 ? firstSec : times[index - 1]! + staggerSec);
  }
  return times;
}

export const ModelTemplate: React.FC<ModelTemplateProps & BaseProps> = ({
  eyebrow,
  title = 'Uma ideia por cena.',
  accent,
  items = DEFAULT_ITEMS,
  revealAt,
  closing,
  closingAt,
  durationInFrames,
}) => {
  // toda animação sai do frame: nada de CSS animation, Math.random(), Date ou setTimeout
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const shown = items.slice(0, MAX_ITEMS);
  const times = modelTemplateTimes(shown.length, revealAt);
  const columnWidth = modelTemplateColumnWidth(shown.length, width - theme.safe.x * 2);
  const lastSec = times.at(-1) ?? 0;

  return (
    // SceneBackground dá papel + glows + grão, a margem segura, a faixa de 180 px livre para as legendas
    // e o fade de entrada/saída da cena inteira (por isso recebe durationInFrames)
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56 }}>
      <Statement text={title} accent={accent} eyebrow={eyebrow} fontSize={84} />

      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: GAP }}>
        {shown.map((item, index) => {
          // primitivas com `progress` recebem enter(frame, fps, <segundo>): entram desacelerando, na ordem da fala
          const progress = enter(frame, fps, times[index]!);
          return (
            <SceneCard key={index} progress={progress} padding={40} width={columnWidth} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
              {item.icon ? <IconBadge icon={item.icon} size={112} progress={enter(frame, fps, times[index]! + 0.1)} /> : null}
              <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: text.body + 4, lineHeight: 1.15, color: theme.color.slate900 }}>{item.label}</div>
              {item.hint ? <div style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: text.eyebrow, lineHeight: 1.25, color: theme.color.slate600 }}>{item.hint}</div> : null}
            </SceneCard>
          );
        })}
      </div>

      {/* Reveal embrulha qualquer filho que não tenha `progress` próprio */}
      {closing ? (
        <Reveal atSec={closingAt ?? lastSec + 0.9}>
          <Pill variant="emerald" dot>
            {closing}
          </Pill>
        </Reveal>
      ) : null}
    </SceneBackground>
  );
};

// O catálogo (`pnpm mce arsenal models`) lê este objeto do FONTE, sem executar: escreva literais
// (constantes do próprio arquivo valem; chamada de função ou conta, não).
export const entry: ComponentEntry = {
  component: ModelTemplate,
  // exemplo realista e genérico: é o que aparece no Studio e no trecho pronto para a EDL
  sample: {
    eyebrow: 'Como funciona',
    title: 'Três etapas, uma de cada vez.',
    accent: 'uma de cada vez',
    items: DEFAULT_ITEMS,
    revealAt: [1.2, 1.9, 2.6],
    closing: 'pronto para usar',
    closingAt: 3.6,
  },
  defaultDuration: 6,
  // QUANDO usar: o tipo de fala que o modelo ilustra, nunca o vídeo de origem
  description: 'TODO: diga QUANDO usar este modelo (o tipo de fala que ele ilustra) e o que aparece na tela, em uma ou duas frases.',
  // a FORMA: lista, comparação, antes-depois, ciclo, linha do tempo, pilha, hub, medidor…
  tags: ['todo'],
  origin: { project: 'avulso', date: '2026-01-01' },
  // uma linha por prop: nome, tipo como no JSON da EDL, e para que serve
  slots: [
    { name: 'eyebrow', type: 'string?', description: 'rótulo pequeno acima do título' },
    { name: 'title', type: 'string', description: 'a frase da cena' },
    { name: 'accent', type: 'string?', description: 'trecho do título em coral' },
    { name: 'items', type: '{ label: string; hint?: string; icon?: IconName }[] (2 a 5)', description: 'um cartão por item, na ordem da fala' },
    { name: 'revealAt', type: 'number[]', description: 'segundo em que cada item entra, por índice' },
    { name: 'closing', type: 'string?', description: 'pílula de fecho depois do último item' },
    { name: 'closingAt', type: 'number?', description: 'segundo em que a pílula de fecho entra' },
  ],
};
