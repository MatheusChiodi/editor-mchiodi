import { entryDeadline } from '../../motion/src/components/timing.ts';
import { minReadSec, readWords } from '../../motion/src/components/read-time.ts';

/**
 * Validação das props dos componentes de palco ANTES de entrar na EDL (`mce motion add`): devolve avisos claros
 * do que o componente vai ignorar, encolher ou reposicionar. Nunca bloqueia (os componentes já são robustos a
 * props extremas); só diz ao diretor o que ele pediu e não vai aparecer como pediu.
 *
 * Os limites espelham as constantes dos componentes (MAX_PILLS, MAX_CARDS, MAX_LINES...); o teste confere.
 */
export const LIMITS = { pills: 5, cards: 6, lines: 9, notes: 4 } as const;
export const PILL_TONES = ['paper', 'coral', 'ink', 'emerald', 'danger'] as const;

type Props = Record<string, unknown>;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const rec = (value: unknown): Props => (value && typeof value === 'object' ? (value as Props) : {});

/** Instantes (`at`, `wordAt`, `revealAt`...) fora do overlay ou sem tempo de leitura. */
function lateTimes(label: string, times: readonly unknown[], durationSec: number, readSec: number): string[] {
  const deadline = entryDeadline(durationSec, readSec);
  const bad = times.filter((value) => isNumber(value) && value > deadline);
  const invalid = times.filter((value) => value !== undefined && (!isNumber(value) || value < 0));
  return [
    ...(bad.length ? [`${label}: ${bad.length} instante(s) depois de ${deadline.toFixed(1)}s (o overlay dura ${durationSec}s e o texto precisa de ${readSec.toFixed(1)}s de leitura); o render puxa para antes`] : []),
    ...(invalid.length ? [`${label}: valor(es) inválido(s) (precisa ser número ≥ 0, em segundos desde o início do overlay); caem na cascata padrão`] : []),
  ];
}

function checkPillStack(props: Props, durationSec: number): string[] {
  const items = list(props.items);
  const issues: string[] = [];
  if (items.length === 0) issues.push('items: vazio; a pilha não desenha nada');
  const filled = items.filter((item) => text(rec(item).text).trim());
  if (filled.length < items.length) issues.push(`items: ${items.length - filled.length} pílula(s) sem texto serão descartadas`);
  if (filled.length > LIMITS.pills) issues.push(`items: ${filled.length} pílulas, só as ${LIMITS.pills} primeiras cabem sem cobrir o rosto`);
  filled.slice(0, LIMITS.pills).forEach((item, index) => {
    const tone = rec(item).tone;
    if (tone !== undefined && !(PILL_TONES as readonly unknown[]).includes(tone)) issues.push(`items[${index}].tone "${String(tone)}" não existe (${PILL_TONES.join(', ')}); vira neutro`);
    const strike = rec(item).strikeAt;
    const at = rec(item).at;
    if (isNumber(strike) && isNumber(at) && strike <= at) issues.push(`items[${index}]: strikeAt (${strike}s) não pode vir antes de at (${at}s)`);
  });
  issues.push(...lateTimes('items[].at', filled.slice(0, LIMITS.pills).map((item) => rec(item).at), durationSec, minReadSec(text(rec(filled[filled.length - 1]).text))));
  return issues;
}

function checkSplitExplainer(props: Props, durationSec: number): string[] {
  const issues: string[] = [];
  if (!text(props.title).trim()) issues.push('title: obrigatório; sem ele o painel fica sem título');
  const cards = list(props.cards);
  if (cards.length > LIMITS.cards) issues.push(`cards: ${cards.length} cartões, só os ${LIMITS.cards} primeiros aparecem`);
  const reveal = list(props.revealAt);
  if (reveal.length > cards.length && cards.length > 0) issues.push(`revealAt: ${reveal.length} instantes para ${cards.length} cartões; os de sobra são ignorados`);
  const last = rec(cards[Math.min(cards.length, LIMITS.cards) - 1]);
  issues.push(...lateTimes('revealAt', reveal, durationSec, minReadSec(`${text(last.label)} ${text(last.caption)}`)));
  const titleWords = readWords(text(props.title));
  const wordAt = list(props.wordAt);
  if (wordAt.length > titleWords && titleWords > 0) issues.push(`wordAt: ${wordAt.length} instantes para ${titleWords} palavras do título; os de sobra são ignorados`);
  issues.push(...lateTimes('wordAt', wordAt, durationSec, 1));
  const note = rec(props.note);
  if (note.text && isNumber(note.at)) issues.push(...lateTimes('note.at', [note.at], durationSec, minReadSec(text(note.text))));
  return issues;
}

function checkPhraseReveal(props: Props, durationSec: number): string[] {
  const issues: string[] = [];
  const body = text(props.text);
  if (!body.trim()) issues.push('text: obrigatório; sem ele não há frase');
  const words = readWords(body);
  if (body.replace(/\*|==/g, '').length > 80) issues.push(`text: ${body.length} caracteres; a fonte encolhe até o piso de 72px, prefira uma frase curta (até ~22 caracteres cabe no tamanho cheio)`);
  const wordAt = list(props.wordAt);
  if (wordAt.length > 0 && wordAt.length !== words) issues.push(`wordAt: ${wordAt.length} instantes para ${words} palavras; as que faltam entram em cascata e as de sobra são ignoradas`);
  issues.push(...lateTimes('wordAt', wordAt, durationSec, 1));
  if (durationSec < minReadSec(body)) issues.push(`duração ${durationSec}s menor que a leitura mínima da frase (${minReadSec(body).toFixed(1)}s)`);
  return issues;
}

function checkDocQuote(props: Props, durationSec: number): string[] {
  const issues: string[] = [];
  const body = text(props.text);
  if (!body.trim()) issues.push('text: obrigatório; sem ele não há citação');
  if (body.replace(/==/g, '').length > 400) issues.push(`text: ${body.length} caracteres; o cartão encolhe até 30px e passa de 7 linhas, corte o trecho`);
  if (body.length > 0 && !body.includes('==')) issues.push('text: sem `==trecho==`; o marca-texto não tem onde correr');
  if (isNumber(props.markAt) && props.markAt > durationSec - 1.5) issues.push(`markAt ${props.markAt}s deixa menos de 1,5s para o marca-texto correr (overlay de ${durationSec}s); o render puxa para antes`);
  // a citação é lida em voz alta: a leitura mínima vale para o trecho marcado, que é o que o espectador precisa ler
  const marked = [...body.matchAll(/==(.+?)==/g)].map((match) => match[1]!).join(' ');
  const need = minReadSec(marked || body);
  if (durationSec < need) issues.push(`duração ${durationSec}s menor que a leitura mínima do trecho marcado (${need.toFixed(1)}s)`);
  return issues;
}

function checkWindowStage(props: Props, durationSec: number): string[] {
  const issues: string[] = [];
  const kind = props.kind ?? 'terminal';
  if (!['terminal', 'screen', 'footage'].includes(String(kind))) issues.push(`kind "${String(kind)}" não existe (terminal, screen, footage); vira terminal`);
  const lines = list(props.lines);
  if (kind === 'terminal' && lines.length === 0) issues.push('lines: vazio; a janela abre sem conteúdo');
  if (lines.length > LIMITS.lines) issues.push(`lines: ${lines.length} linhas, só as ${LIMITS.lines} primeiras cabem`);
  const notes = list(props.notes);
  if (notes.length > LIMITS.notes) issues.push(`notes: ${notes.length} pílulas, no máximo ${LIMITS.notes} (menos com o apresentador em canto)`);
  issues.push(...lateTimes('lines[].at', lines.map((line) => rec(line).at), durationSec, 1));
  issues.push(...lateTimes('notes[].at', notes.map((note) => rec(note).at), durationSec, minReadSec(text(rec(notes[notes.length - 1]).text))));
  return issues;
}

const CHECKS: Record<string, (props: Props, durationSec: number) => string[]> = {
  PillStack: checkPillStack,
  SplitExplainer: checkSplitExplainer,
  PhraseReveal: checkPhraseReveal,
  DocQuote: checkDocQuote,
  WindowStage: checkWindowStage,
};

/** Avisos das props de um componente de palco; `[]` quando está tudo no limite (ou o componente não tem checagem). */
export function checkStageProps(component: string, props: Props | undefined, durationSec: number): string[] {
  const check = CHECKS[component];
  if (!check) return [];
  return check(props ?? {}, isNumber(durationSec) && durationSec > 0 ? durationSec : 0.001).map((issue) => `${component}.${issue}`);
}
