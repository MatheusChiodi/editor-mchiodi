import type { Config } from '../config.ts';
import { headlessArgs } from '../watcher/headless.ts';

export interface PanelSelection {
  /** intervalo selecionado na timeline, em segundos da FONTE */
  start?: number;
  end?: number;
  /** ids de clipes/overlays/zooms selecionados */
  ids?: string[];
}

export interface PanelRequest {
  slug: string;
  /** versão da EDL que o Matheus está vendo (a proposta tem de partir dela) */
  version: number;
  level: string;
  instruction: string;
  selection?: PanelSelection;
}

export function describeSelection(selection: PanelSelection | undefined): string {
  const parts: string[] = [];
  if (selection?.start !== undefined && selection.end !== undefined) {
    parts.push(`intervalo da fonte ${selection.start.toFixed(2)}s–${selection.end.toFixed(2)}s (pnpm mce words <slug> --from ${selection.start.toFixed(2)} --to ${selection.end.toFixed(2)})`);
  }
  if (selection?.ids?.length) parts.push(`itens: ${selection.ids.join(', ')}`);
  return parts.length ? parts.join('; ') : 'nada selecionado (a instrução vale para o vídeo todo)';
}

/** Arquivo de rascunho que a sessão escreve antes do `mce edl save` (fora de edl/, que só tem versões). */
export function proposalDraftPath(slug: string): string {
  return `projects/${slug}/cut/proposta.json`;
}

/**
 * Pedido do painel Claude. A sessão headless segue as skills edit-video/edl-reference e responde sempre com
 * UMA nova versão de EDL via `mce edl save`; a UI mostra o diff e o Matheus aceita ou rejeita.
 */
export function buildPanelPrompt(request: PanelRequest): string {
  const { slug, version } = request;
  return [
    `Pedido do Matheus pelo painel do MChiodi Cut, projeto "${slug}", EDL atual v${version} (nível ${request.level}).`,
    `Seleção na timeline: ${describeSelection(request.selection).replace('<slug>', slug)}.`,
    'Instrução (texto do Matheus, literal):',
    '"""',
    request.instruction.trim(),
    '"""',
    'Como responder:',
    `- Siga as skills edl-reference e edit-video. Parta da v${version} (pnpm mce edl list ${slug}; o arquivo é projects/${slug}/edl/edl.v${version}.json).`,
    `- Responda SEMPRE com uma nova versão: escreva a EDL completa em ${proposalDraftPath(slug)} e grave com pnpm mce edl save ${slug} ${proposalDraftPath(slug)}. Uma versão só, com notes começando por "Claude (painel): " dizendo o que mudou e por quê.`,
    '- Nunca edite, mova ou apague mídia, nunca sobrescreva uma EDL existente. Todo tempo em segundos da fonte; corte só em pausa com silêncio medido; todo overlay/zoom/efeito/transição com reason.',
    '- Versões com notes "Matheus:" são decisões dele: não desfaça nada delas sem que a instrução peça.',
    `- Não troque o nível (${request.level}). Não renderize nem rode eval: o Matheus revisa o diff no editor.`,
    '- Se a instrução não fizer sentido ou exigir algo fora da EDL, não grave nada e explique.',
    'Ninguém vai responder perguntas. Termine com uma linha "RESULTADO: ok — <resumo>" ou "RESULTADO: falha — <motivo>".',
  ].join('\n');
}

/** Argumentos do `claude -p` do painel: os do watcher (mesmas permissões e fontes de configuração), com saída em stream. */
export function panelArgs(prompt: string, config: Config['headless']): string[] {
  const args = headlessArgs(prompt, config);
  const index = args.indexOf('--output-format');
  if (index >= 0) args[index + 1] = 'stream-json';
  // o stream-json do modo -p exige --verbose
  return [...args, '--verbose'];
}

export type StreamEvent =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | { kind: 'result'; ok: boolean; text: string; costUsd: number | null; turns: number | null };

/** Uma linha do `--output-format stream-json` → o que a UI mostra. Linha que não interessa vira lista vazia. */
export function parseStreamLine(line: string): StreamEvent[] {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return line.trim() ? [{ kind: 'text', text: line }] : [];
  }
  if (json.type === 'assistant') {
    const content = ((json.message as { content?: unknown[] } | undefined)?.content ?? []) as Record<string, unknown>[];
    return content.flatMap((block): StreamEvent[] => {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) return [{ kind: 'text', text: block.text }];
      if (block.type === 'tool_use') {
        const input = (block.input ?? {}) as Record<string, unknown>;
        const detail = String(input.command ?? input.file_path ?? input.pattern ?? input.description ?? '');
        return [{ kind: 'tool', name: String(block.name ?? '?'), detail: detail.slice(0, 200) }];
      }
      return [];
    });
  }
  if (json.type === 'result') {
    return [{
      kind: 'result',
      ok: !json.is_error,
      text: typeof json.result === 'string' ? json.result : '',
      costUsd: typeof json.total_cost_usd === 'number' ? json.total_cost_usd : null,
      turns: typeof json.num_turns === 'number' ? json.num_turns : null,
    }];
  }
  return [];
}
