import { describe, expect, it } from 'vitest';

import { type Artifact, artifactKey, covers, pendingArtifacts, scaffoldSkill, skillNameFor } from '../src/skills/audit.ts';

const artifact = (kind: Artifact['kind'], id: string, extra: Partial<Artifact> = {}): Artifact => ({ kind, id, source: `motion/src/${id}.tsx`, ...extra });

describe('covers (uma skill cobre o que ela cita)', () => {
  it('cita o id como palavra inteira', () => {
    expect(covers('Use o componente PathDraw para traçar caminhos', 'PathDraw')).toBe(true);
    expect(covers('`PathDraw`, ShapeMorph', 'ShapeMorph')).toBe(true);
  });
  it('id que é só pedaço de outro nome não conta', () => {
    expect(covers('Use BurstPlus', 'Burst')).toBe(false);
    expect(covers('barra de progresso', 'ProgressBar')).toBe(false);
  });
  it('id em minúsculas (cena, pose) também casa como palavra', () => {
    expect(covers('pose `faceHands` com as mãos no rosto', 'faceHands')).toBe(true);
    expect(covers('phones', 'phone')).toBe(false);
  });
});

describe('pendingArtifacts', () => {
  const skills = new Map([
    ['motion-graphics-insercao', 'Componentes: PathDraw, ShapeMorph e Burst'],
    ['cena-celular', 'Cena celular (motif phone)'],
  ]);
  const all = [artifact('componente', 'PathDraw'), artifact('componente', 'NovoGrafico'), artifact('motivo', 'phone'), artifact('motivo', 'rain')];

  it('só o que é novo (fora do baseline) e sem skill que o cite', () => {
    const pending = pendingArtifacts(all, skills, new Set());
    expect(pending.map((a) => a.id)).toEqual(['NovoGrafico', 'rain']);
  });
  it('o que já existia antes da regra (baseline) não reprova, mesmo sem skill', () => {
    const baseline = new Set([artifactKey(artifact('componente', 'NovoGrafico'))]);
    expect(pendingArtifacts(all, skills, baseline).map((a) => a.id)).toEqual(['rain']);
  });
  it('com `includeBaseline` mostra também o legado sem skill (a fila para ir aprendendo)', () => {
    const baseline = new Set(all.map(artifactKey));
    expect(pendingArtifacts(all, skills, baseline, { includeBaseline: true }).map((a) => a.id)).toEqual(['NovoGrafico', 'rain']);
  });
  it('sem skills nenhuma, tudo fora do baseline é pendência', () => {
    expect(pendingArtifacts(all, new Map(), new Set())).toHaveLength(4);
  });
});

describe('skillNameFor', () => {
  it('prefixo por tipo e kebab-case', () => {
    expect(skillNameFor(artifact('componente', 'PathDraw'))).toBe('componente-path-draw');
    expect(skillNameFor(artifact('modelo', 'PilhaDeCartas'))).toBe('modelo-pilha-de-cartas');
    expect(skillNameFor(artifact('motivo', 'rain'))).toBe('cena-rain');
    expect(skillNameFor(artifact('cenario', 'bedroom'))).toBe('cenario-bedroom');
    expect(skillNameFor(artifact('pose', 'faceHands'))).toBe('pose-face-hands');
  });
});

describe('scaffoldSkill', () => {
  const text = scaffoldSkill(artifact('componente', 'NovoGrafico', { source: 'motion/src/components/NovoGrafico.tsx', sample: { title: 'x' }, description: 'Mostra um gráfico novo.' }));
  it('frontmatter válido, com nome coerente e descrição de quando usar', () => {
    const m = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(text);
    expect(m?.[1]).toBe('componente-novo-grafico');
    expect(m?.[2]).toContain('Mostra um gráfico novo.');
    expect(m?.[2]?.length).toBeGreaterThan(60);
  });
  it('traz onde está o código, as props de exemplo e as seções que a regra pede', () => {
    expect(text).toContain('motion/src/components/NovoGrafico.tsx');
    expect(text).toContain('"title": "x"');
    for (const section of ['## Quando usar', '## Onde está', '## Receita', '## Armadilhas', '## Validar']) expect(text).toContain(section);
  });
  it('cita o próprio id (é assim que a auditoria sabe que está coberto)', () => {
    expect(covers(text, 'NovoGrafico')).toBe(true);
  });
  it('marca o que ainda precisa ser preenchido à mão', () => {
    expect(text).toContain('PREENCHER');
  });
});
