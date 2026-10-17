import { resolve } from 'node:path';

/** O mínimo de um comando do commander que `bareGroup` precisa (permite testar sem montar a CLI). */
export interface CommandNode {
  name(): string;
  aliases(): readonly string[];
  readonly commands: readonly CommandNode[];
}

/**
 * Grupo chamado sem subcomando (`mce`, `mce scenes`, `mce edl`...): devolve o comando cuja ajuda
 * deve ser impressa. O commander, sozinho, imprime a ajuda no stderr e sai com 1, e o pnpm acrescenta
 * "Command failed"; pedir a lista de subcomandos não é erro.
 * null = deixa o commander resolver (comando folha, opção, subcomando desconhecido).
 */
export function bareGroup<T extends CommandNode>(root: T, args: readonly string[]): T | null {
  let node: CommandNode = root;
  for (const token of args) {
    const next = node.commands.find((command) => command.name() === token || command.aliases().includes(token));
    if (!next) return null;
    node = next;
  }
  return node.commands.length > 0 ? (node as T) : null;
}

/**
 * Caminho digitado pelo usuário vale a partir da pasta onde ELE está, não da raiz do projeto
 * (a CLI muda o diretório de trabalho para a raiz ao iniciar).
 */
export function userPath(userCwd: string, file: string): string {
  return resolve(userCwd, file);
}
