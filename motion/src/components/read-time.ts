/**
 * Tempo de leitura de um texto curto na tela. Arquivo sem React nem Remotion: a autoavaliação
 * (`src/eval`) usa a mesma conta que os componentes.
 */
export const READ_BASE_SEC = 1.2;
export const READ_PER_WORD_SEC = 0.25;
/** texto longo (acima de 12 palavras): 0,35 s por palavra passa a mandar */
export const READ_LONG_PER_WORD_SEC = 0.35;
/** nenhuma entrada a menos de 1 s do fim do overlay (a última palavra de uma frase revelada) */
export const LAST_ENTRY_SEC = 1;

/** Palavras de um texto, sem a marcação `*itálico*` e `==marca-texto==`. */
export function readWords(text: string): number {
  return text.replace(/\*|==/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Tempo mínimo que um texto fica na tela: 1,2 s + 0,25 s por palavra (docs/referencia-max.md §10.6),
 * e nunca menos que 0,35 s por palavra, que só pesa em texto com mais de 12 palavras.
 */
export function minReadSec(text: string): number {
  const words = readWords(text);
  return Math.max(READ_BASE_SEC + READ_PER_WORD_SEC * words, READ_LONG_PER_WORD_SEC * words);
}
