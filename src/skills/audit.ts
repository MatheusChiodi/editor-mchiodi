/**
 * Auditoria das skills: toda animação, efeito, cena, pose ou cenário novo precisa de uma skill que torne o Claude
 * especialista em fazê-lo de novo (regra do Matheus). Núcleo puro: a coleta dos artefatos fica em `artifacts.ts`.
 */
export type ArtifactKind = 'componente' | 'modelo' | 'motivo' | 'cenario' | 'pose' | 'camera' | 'transicao';

export interface Artifact {
  kind: ArtifactKind;
  id: string;
  /** arquivo onde o código vive, relativo à raiz do projeto */
  source: string;
  /** props de exemplo (componentes e modelos) */
  sample?: Record<string, unknown>;
  /** descrição que o próprio código declara */
  description?: string;
}

export const artifactKey = (artifact: Pick<Artifact, 'kind' | 'id'>): string => `${artifact.kind}:${artifact.id}`;

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Uma skill cobre o artefato quando cita o id como palavra inteira (`Burst` não é coberto por `BurstPlus`). */
export function covers(skillText: string, id: string): boolean {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegex(id)}(?![A-Za-z0-9])`).test(skillText);
}

export interface PendingOptions {
  /** inclui o legado (anterior à regra) que ainda não tem skill: a fila para ir aprendendo aos poucos */
  includeBaseline?: boolean;
}

/** Artefatos sem skill que os cite. O baseline guarda o que já existia quando a regra nasceu e não reprova. */
export function pendingArtifacts(artifacts: Artifact[], skills: Map<string, string>, baseline: Set<string>, options: PendingOptions = {}): Artifact[] {
  const texts = [...skills.values()];
  return artifacts.filter((artifact) => {
    if (!options.includeBaseline && baseline.has(artifactKey(artifact))) return false;
    return !texts.some((text) => covers(text, artifact.id));
  });
}

const PREFIX: Record<ArtifactKind, string> = {
  componente: 'componente',
  modelo: 'modelo',
  motivo: 'cena',
  cenario: 'cenario',
  pose: 'pose',
  camera: 'camera',
  transicao: 'transicao',
};

const kebab = (text: string) => text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase().replace(/^-+|-+$/g, '');

export const skillNameFor = (artifact: Pick<Artifact, 'kind' | 'id'>): string => `${PREFIX[artifact.kind]}-${kebab(artifact.id)}`;

const KIND_LABEL: Record<ArtifactKind, string> = {
  componente: 'o componente',
  modelo: 'o modelo de animação',
  motivo: 'a cena ilustrativa',
  cenario: 'o cenário da história',
  pose: 'a pose do personagem',
  camera: 'o movimento de câmera',
  transicao: 'a transição',
};

/**
 * Esqueleto de skill já com o que o código sabe (arquivo, descrição, props de exemplo) e as seções que a regra pede.
 * O que só quem fez conhece fica marcado com PREENCHER: o Claude completa antes de entregar.
 */
export function scaffoldSkill(artifact: Artifact): string {
  const name = skillNameFor(artifact);
  const what = KIND_LABEL[artifact.kind];
  const about = artifact.description ? ` ${artifact.description}` : '';
  const sample = artifact.sample ? `\n\nProps de exemplo:\n\n\`\`\`json\n${JSON.stringify(artifact.sample, null, 2)}\n\`\`\`` : '';
  return `---
name: ${name}
description: Torna o Claude especialista em ${what} ${artifact.id}.${about} Use ao criar, ajustar ou reaproveitar ${artifact.id} em um vídeo (PREENCHER: palavras da fala ou situações que pedem isso).
---

# ${artifact.id}

## Quando usar
PREENCHER: que fala, ideia ou momento do vídeo pede ${artifact.id}; quando NÃO usar.

## Onde está
\`${artifact.source}\` (${what} \`${artifact.id}\`).${sample}

## Como funciona
PREENCHER: parâmetros e faixas válidas, tempos, o que reage à música/fala, o que depende de quê.

## Receita
1. PREENCHER: passo a passo para usar ou criar variações, do jeito que deu certo.
2. Conferir o resultado em um quadro real (\`pnpm mce motion still\`, prévia ao vivo ou frame renderizado).

## Armadilhas
PREENCHER: o que já deu errado e como evitar.

## Validar
\`pnpm test\`, \`pnpm typecheck\` e ver o resultado. PREENCHER: o teste que cobre ${artifact.id}.
`;
}
