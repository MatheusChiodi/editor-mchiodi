import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export type NoteKind = 'decisao' | 'correcao' | 'pendencia';

const SECTION: Record<NoteKind, string> = {
  decisao: '## Decisões de edição',
  correcao: '## Correções do Matheus',
  pendencia: '## Pendências',
};

/** project.md recém-criado: o diretor lê isto antes de retomar uma edição. */
export function memoryTemplate(slug: string): string {
  return [
    `# Memória do projeto — ${slug}`,
    '',
    'Lido pelo diretor antes de qualquer edição deste vídeo. Registre aqui o que não está na EDL:',
    'por que uma decisão foi tomada, o que o Matheus corrigiu e o que ficou pendente.',
    'Correção que vale para todos os vídeos vai também para o STYLE.md.',
    '',
    SECTION.decisao,
    '',
    SECTION.correcao,
    '',
    SECTION.pendencia,
    '',
  ].join('\n');
}

/** Insere uma nota datada no fim da seção correspondente, preservando o resto do arquivo. */
export function addNote(content: string, kind: NoteKind, text: string, date: string): string {
  const heading = SECTION[kind];
  const lines = content.split(/\r?\n/);
  let start = lines.indexOf(heading);
  if (start < 0) {
    // arquivo editado à mão sem a seção: recria no fim
    while (lines.length && lines.at(-1) === '') lines.pop();
    lines.push('', heading, '');
    start = lines.length - 2;
  }
  let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  if (end < 0) end = lines.length;
  while (end > start + 1 && lines[end - 1] === '') end -= 1;
  const note = `- ${date}: ${text.trim().replace(/\s*\n\s*/g, ' ')}`;
  lines.splice(end, 0, ...(end === start + 1 ? ['', note] : [note]));
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

export function appendNote(file: string, slug: string, kind: NoteKind, text: string, now = new Date()): void {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : memoryTemplate(slug);
  writeFileSync(file, addNote(current, kind, text, now.toISOString().slice(0, 10)), 'utf8');
}

/**
 * Troca o corpo de uma seção `## ...` inteira (cria no fim se não existe). Para dado que é regenerado,
 * como a retenção importada: reimportar substitui, não acumula.
 */
export function replaceSection(content: string, heading: string, body: string[]): string {
  const lines = content.split(/\r?\n/);
  const start = lines.indexOf(heading);
  if (start < 0) {
    while (lines.length && lines.at(-1) === '') lines.pop();
    lines.push('', heading, '', ...body);
    return `${lines.join('\n')}\n`;
  }
  let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  if (end < 0) end = lines.length;
  lines.splice(start + 1, end - start - 1, '', ...body, ...(end < lines.length ? [''] : []));
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

export const RETENTION_SECTION = '## Retenção (YouTube)';

export function writeSection(file: string, slug: string, heading: string, body: string[]): void {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : memoryTemplate(slug);
  writeFileSync(file, replaceSection(current, heading, body), 'utf8');
}

export interface ProjectStatus {
  slug: string;
  analyzed: boolean;
  edlVersions: number[];
  renders: string[];
  lastEval: { edlVersion: number; passed: boolean; errors: number; warnings: number } | null;
  delivered: string[];
  hasMemory: boolean;
}

/** Em que pé está o projeto e qual o próximo passo, para retomar sem reler tudo. */
export function describeStatus(status: ProjectStatus): string {
  const lines = [`projeto: ${status.slug}`];
  if (!status.analyzed) return [...lines, 'próximo passo: pnpm mce analyze <arquivo>'].join('\n');
  lines.push(
    `EDL: ${status.edlVersions.length ? `versões ${status.edlVersions.join(', ')}` : 'nenhuma'}`,
    `renders: ${status.renders.join(', ') || 'nenhum'}`,
    `última avaliação: ${
      status.lastEval
        ? `EDL v${status.lastEval.edlVersion} ${status.lastEval.passed ? 'aprovada' : 'reprovada'} (${status.lastEval.errors} erros, ${status.lastEval.warnings} avisos)`
        : 'nenhuma'
    }`,
    `entregues: ${status.delivered.join(', ') || 'nada ainda'}`,
    `memória (project.md): ${status.hasMemory ? 'existe — leia antes de editar' : 'vazia'}`,
  );
  const latest = status.edlVersions.at(-1);
  let next: string;
  if (latest === undefined) next = `pnpm mce draft ${status.slug}`;
  else if (!status.renders.includes(`v${latest}-preview`)) next = `pnpm mce render ${status.slug}`;
  else if (!status.lastEval || status.lastEval.edlVersion !== latest) next = `pnpm mce eval ${status.slug}`;
  else if (!status.lastEval.passed) next = 'corrigir a EDL conforme a avaliação e gravar nova versão';
  else if (!status.delivered.includes('final.mp4')) next = `pnpm mce render ${status.slug} --final`;
  else if (!status.delivered.includes('relatorio.md')) next = `pnpm mce report ${status.slug}`;
  else next = 'concluído; novas correções viram uma nova versão da EDL';
  lines.push(`próximo passo: ${next}`);
  return lines.join('\n');
}
