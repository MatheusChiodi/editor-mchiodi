import type { AppliedOp, ItemKind } from './ops.ts';

const KIND_LABEL: Record<ItemKind, string> = {
  overlays: 'overlay',
  broll: 'b-roll',
  zooms: 'zoom',
  transitions: 'transição',
  effects: 'efeito',
  sfx: 'sfx',
};

const secs = (value: number) => `${value.toFixed(2)}s`;
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}s`;

/** Uma frase curta por operação, com os valores já depois do snap. */
export function describeOp({ op, detail }: AppliedOp): string {
  switch (op.type) {
    case 'trimClip': {
      const delta = (detail.to ?? 0) - (detail.from ?? 0);
      return `moveu ${op.edge === 'start' ? 'início' : 'fim'} de ${op.clipId} ${signed(delta)}`;
    }
    case 'removeRange':
      return `removeu ${secs(detail.start!)}–${secs(detail.end!)} (${secs(detail.end! - detail.start!)})`;
    case 'restoreRange':
      return `restaurou ${secs(detail.start!)}–${secs(detail.end!)}`;
    case 'moveItem': {
      const fields = detail.fields ?? [];
      const what = `${KIND_LABEL[op.kind]} ${detail.label ?? op.id}`;
      const parts: string[] = [];
      if (op.at !== undefined) parts.push(`para ${secs(op.at)}`);
      if (op.start !== undefined || op.end !== undefined) parts.push(`para ${secs(op.start ?? detail.to ?? 0)}${op.end !== undefined ? `–${secs(op.end)}` : ''}`);
      if (op.duration !== undefined) parts.push(`duração ${secs(op.duration)}`);
      if (op.intoClip !== undefined) parts.push(`no corte de ${op.intoClip}`);
      const verb = fields.length === 1 && fields[0] === 'duration' ? 'redimensionou' : 'moveu';
      return `${verb} ${what}${parts.length ? ` ${parts.join(', ')}` : ''}`;
    }
    case 'insertItem':
      return `inseriu ${KIND_LABEL[op.kind]} ${detail.label ?? ''}${detail.to !== undefined ? ` em ${secs(detail.to)}` : ''}`.trimEnd();
    case 'updateItem':
      return `editou ${KIND_LABEL[op.kind]} ${detail.label ?? op.id}${detail.fields?.length ? ` (${detail.fields.join(', ')})` : ''}`;
    case 'removeItem':
      return `removeu ${KIND_LABEL[op.kind]} ${detail.label ?? op.id}`;
    case 'captionReplace':
      return op.to === null || op.to === ''
        ? `desfez a correção de legenda '${op.from}'`
        : `corrigiu legenda '${op.from}'→'${op.to}'`;
    case 'captionHighlight':
      return op.on ? `destacou '${op.word}' na legenda` : `tirou o destaque de '${op.word}'`;
    case 'setLevel':
      return `trocou o nível ${detail.previous ?? '?'} → ${op.level}`;
  }
}

/**
 * `notes` da versão salva pelo editor. O prefixo "Matheus:" marca decisão dele: a skill edit-video
 * não desfaz essas mudanças sem ele pedir.
 */
export function buildNotes(applied: AppliedOp[], message?: string): string {
  const phrases = applied.map(describeOp);
  const extra = message?.trim();
  if (phrases.length === 0) return `Matheus: ${extra || 'sem mudanças'}`;
  return `Matheus: ${phrases.join('; ')}${extra ? ` — ${extra}` : ''}`;
}
