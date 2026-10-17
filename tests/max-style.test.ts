import { describe, expect, it } from 'vitest';

import {
  CARD_RADIUS,
  contentRect,
  coverTransform,
  easeIn,
  easeOut,
  FULL,
  holeAt,
  holePath,
  IDENTITY,
  linkStages,
  normalizePushes,
  PRESENTER_SLOTS,
  pushAt,
  type PresenterSpec,
  roundedRectPath,
  slotRect,
  slotTransform,
  slotZoom,
  type StagePlan,
  stageProgress,
  stageRamps,
  tearJitter,
  tearPolygon,
  transformAt,
  windowBodyRect,
} from '../motion/src/arsenal/stage.ts';
import { DocQuote, entry as docQuote, markStart, quoteFontSize } from '../motion/src/components/DocQuote.tsx';
import { entry as phraseReveal, PHRASE_MAX, phraseFontSize } from '../motion/src/components/PhraseReveal.tsx';
import { entry as pillStack, exitProgress, MAX_PILLS, stackItems, titleFontSize } from '../motion/src/components/PillStack.tsx';
import { registry } from '../motion/src/components/registry.ts';
import { cardColumns, cardTimes, entry as splitExplainer, explainerTitleSize, TITLE_MAX, TITLE_START } from '../motion/src/components/SplitExplainer.tsx';
import { cueTimes, markupWords, minReadSec, parseMarkup, pillColors, pillTilt, plainText, resolveTone } from '../motion/src/components/stage-kit.tsx';
import { entry as windowStage, lineTone, typedLength, TYPE_SEC } from '../motion/src/components/WindowStage.tsx';
import { theme } from '../motion/src/theme.ts';
import type { OverlayItem } from '../motion/src/types.ts';
import type { Transcript } from '../src/analyze/types.ts';
import { catalog } from '../src/arsenal/catalog.ts';
import { formatLevels, formatMinimum, LEVEL_IDS, LEVELS, MAX_PATTERNS, requiredCount } from '../src/edl/levels.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { buildBudget, buildRequired, countPattern, formatBudget, judgeRequired } from '../src/eval/budget.ts';
import { idleGaps, lintStyle, overlayCues, visualEvents } from '../src/eval/checks.ts';
import { buildLayoutGraph } from '../src/render/layout.ts';
import { buildOverlayProps } from '../src/render/overlay.ts';
import { placeStages, reframeFilters, stageExpressions, stageTermExpr, windowLayouts } from '../src/render/reframe.ts';

const W = 1920;
const H = 1080;
const spec = (slot: PresenterSpec['slot'], extra: Partial<PresenterSpec> = {}): PresenterSpec => ({ slot, focus: { x: 0.5, y: 0.4 }, backdrop: 'paper', ...extra });
const plan = (slot: PresenterSpec['slot'], extra: Partial<StagePlan> = {}): StagePlan => ({ ...spec(slot), from: null, holdExit: false, ...extra });

function edlWith(extra: Record<string, unknown>) {
  return edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-12T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 130, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [
      { id: 'c1', start: 0, end: 60 },
      { id: 'c2', start: 70, end: 130 },
    ],
    ...extra,
  });
}

const transcript: Transcript = { language: 'pt', words: [] } as unknown as Transcript;

/** Avalia uma expressão do ffmpeg (subconjunto usado no reenquadramento) num instante `t`. */
function evalExpr(expression: string, t: number): number {
  const scope = {
    t,
    gte: (a: number, b: number) => (a >= b ? 1 : 0),
    lt: (a: number, b: number) => (a < b ? 1 : 0),
    pow: Math.pow,
    clip: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
  };
  return new Function(...Object.keys(scope), `return ${expression};`)(...Object.values(scope)) as number;
}

describe('palco: geometria', () => {
  it('todo slot cabe no quadro e o cartão lateral deixa a coluna de conteúdo livre', () => {
    for (const slot of PRESENTER_SLOTS) {
      const rect = slotRect(slot);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(1);
      expect(rect.y + rect.h).toBeLessThanOrEqual(1);
      expect(slotZoom(slot)).toBeGreaterThanOrEqual(1);
    }
    expect(slotRect('right').x).toBeCloseTo(1 - slotRect('left').x - slotRect('left').w);
    expect(slotRect('pip-br').y).toBeGreaterThan(0.5);
    expect(slotRect('pip-tl').x).toBeLessThan(0.1);
    const content = contentRect('right');
    expect(content.x + content.w).toBeLessThanOrEqual(slotRect('right').x);
    expect(contentRect('left').x).toBeGreaterThanOrEqual(slotRect('left').x + slotRect('left').w);
    expect(contentRect(null)).toEqual(FULL);
  });

  it('curvas: entra desacelerando, sai acelerando, limitadas a 0–1', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
    expect(easeIn(0.5)).toBeLessThan(0.5);
    expect(easeOut(2)).toBe(1);
    expect(easeIn(-1)).toBe(0);
  });

  it('palco curto divide o tempo: entrada e saída nunca passam de um terço cada', () => {
    // padrão medido: 27 f nas duas direções; `transitionSec` troca por overlay
    expect(stageRamps(10)).toEqual({ enter: 0.9, exit: 0.9 });
    expect(stageRamps(10, 0.5)).toEqual({ enter: 0.5, exit: 0.5 });
    expect(stageRamps(0.9).enter).toBeCloseTo(0.3);
    expect(stageRamps(0.9).exit).toBeCloseTo(0.3);
    expect(stageProgress(0, 4)).toEqual({ enter: 0, exit: 0 });
    expect(stageProgress(2, 4)).toEqual({ enter: 1, exit: 0 });
    expect(stageProgress(4, 4).exit).toBeCloseTo(1);
    expect(stageProgress(4, 4, true).exit).toBe(0);
  });

  it('o buraco nasce do quadro inteiro, pousa no slot e volta', () => {
    expect(holeAt(plan('right'), 0, 5)).toMatchObject({ rect: FULL, radius: 0, border: 0 });
    const landed = holeAt(plan('right'), 2, 5);
    expect(landed.rect.x).toBeCloseTo(slotRect('right').x);
    expect(landed.radius).toBe(CARD_RADIUS);
    const back = holeAt(plan('right'), 5, 5);
    for (const key of ['x', 'y', 'w', 'h'] as const) expect(back.rect[key]).toBeCloseTo(FULL[key]);
    expect(back.border).toBe(0);
    // colado no próximo: fica no slot até o fim
    expect(holeAt(plan('right', { holdExit: true }), 5, 5).rect.w).toBeCloseTo(slotRect('right').w);
    // vindo de outro palco: começa no slot anterior, já com o raio do cartão
    const linked = holeAt(plan('pip-br', { from: spec('right') }), 0, 5);
    expect(linked.rect.x).toBeCloseTo(slotRect('right').x);
    expect(linked.radius).toBe(CARD_RADIUS);
  });

  it('coverTransform cobre o retângulo com o foco no centro, sem descobrir borda', () => {
    for (const slot of PRESENTER_SLOTS) {
      for (const focus of [{ x: 0.5, y: 0.4 }, { x: 0, y: 0 }, { x: 1, y: 1 }]) {
        const rect = slotRect(slot);
        const transform = coverTransform(rect, focus, slotZoom(slot), W, H);
        expect(transform.x).toBeLessThanOrEqual(rect.x * W + 1e-6);
        expect(transform.y).toBeLessThanOrEqual(rect.y * H + 1e-6);
        expect(transform.x + W * transform.scale).toBeGreaterThanOrEqual((rect.x + rect.w) * W - 1e-6);
        expect(transform.y + H * transform.scale).toBeGreaterThanOrEqual((rect.y + rect.h) * H - 1e-6);
      }
    }
    const rect = slotRect('right');
    const centered = coverTransform(rect, { x: 0.5, y: 0.5 }, 1.3, W, H);
    expect(centered.x + 0.5 * W * centered.scale).toBeCloseTo((rect.x + rect.w / 2) * W, 3);
    // zoom abaixo de 1 não existe: deixaria o cartão descoberto
    expect(coverTransform(rect, { x: 0.5, y: 0.5 }, 0.2, W, H).scale).toBeGreaterThanOrEqual(rect.h);
  });

  it('em todo instante o footage cobre o buraco (inclusive entre dois palcos colados)', () => {
    const plans = [plan('right'), plan('pip-bl', { from: spec('right', { focus: { x: 0.3, y: 0.6 } }) }), plan('pip-tr', { holdExit: true })];
    for (const item of plans) {
      for (let step = 0; step <= 60; step += 1) {
        const sec = (step / 60) * 3;
        const hole = holeAt(item, sec, 3).rect;
        const transform = transformAt(item, sec, 3, W, H);
        expect(transform.x).toBeLessThanOrEqual(hole.x * W + 1e-6);
        expect(transform.y).toBeLessThanOrEqual(hole.y * H + 1e-6);
        expect(transform.x + W * transform.scale).toBeGreaterThanOrEqual((hole.x + hole.w) * W - 1e-6);
        expect(transform.y + H * transform.scale).toBeGreaterThanOrEqual((hole.y + hole.h) * H - 1e-6);
      }
    }
    expect(transformAt(plan('right'), 0, 3, W, H)).toEqual(IDENTITY);
    const back = transformAt(plan('right'), 3, 3, W, H);
    expect(back.scale).toBeCloseTo(1);
    expect(back.x).toBeCloseTo(0);
    expect(back.y).toBeCloseTo(0);
  });

  it('caminhos: retângulo arredondado e papel com buraco', () => {
    expect(roundedRectPath(0, 0, 100, 50, 0)).toBe('M0 0H100V50H0Z');
    const rounded = roundedRectPath(10, 20, 100, 50, 80);
    // raio limitado à metade do menor lado
    expect(rounded).toContain('A25 25');
    const path = holePath(W, H, [{ rect: slotRect('pip-br'), radius: 40 }]);
    expect(path.startsWith(`M0 0H${W}V${H}H0Z`)).toBe(true);
    expect(path.match(/Z/g)).toHaveLength(2);
    expect(holePath(W, H, [])).toBe(`M0 0H${W}V${H}H0Z`);
  });

  it('rasgo: determinístico, vazio no começo e quadro inteiro no fim', () => {
    expect(tearPolygon(1)).toBe('polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)');
    expect(tearPolygon(0.5)).toBe(tearPolygon(0.5));
    const xs = (polygon: string) => [...polygon.matchAll(/([\d.]+)% [\d.]+%/g)].map((match) => Number(match[1]));
    expect(Math.max(...xs(tearPolygon(0)))).toBeLessThan(8);
    expect(Math.max(...xs(tearPolygon(0.5)))).toBeGreaterThan(40);
    expect(Math.max(...xs(tearPolygon(0.5)))).toBeLessThan(70);
    expect(Math.min(...xs(tearPolygon(0.5)).slice(1, -1))).toBeGreaterThan(30);
    for (let index = 0; index < 30; index += 1) expect(Math.abs(tearJitter(index))).toBeLessThanOrEqual(1);
  });

  it('linkStages liga só os palcos colados', () => {
    const items = [
      { id: 'a', from: 0, durationInFrames: 90, presenter: spec('right') },
      { id: 'b', from: 91, durationInFrames: 60, presenter: spec('pip-br') },
      { id: 'x', from: 100, durationInFrames: 30, presenter: null },
      { id: 'c', from: 300, durationInFrames: 60, presenter: spec('left') },
    ];
    const plans = linkStages(items);
    expect(plans.size).toBe(3);
    expect(plans.get(items[0]!)).toMatchObject({ from: null, holdExit: true });
    expect(plans.get(items[1]!)).toMatchObject({ from: { slot: 'right' }, holdExit: false });
    expect(plans.get(items[3]!)).toMatchObject({ from: null, holdExit: false, slot: 'left' });
  });
});

describe('reenquadramento no ffmpeg', () => {
  const stageItem = (id: string, from: number, frames: number, stage: StagePlan): OverlayItem => ({ id, component: 'SplitExplainer', from, durationInFrames: frames, props: {}, hidesCaptions: true, stage });

  it('placeStages usa a mesma grade de frames da camada de gráficos', () => {
    const placed = placeStages([stageItem('b', 150, 60, plan('pip-br')), stageItem('a', 30, 90, plan('right')), { ...stageItem('n', 0, 10, plan('left')), stage: null }], 30);
    expect(placed.map((item) => [item.start, item.end])).toEqual([[1, 4], [5, 7]]);
  });

  it('as expressões do ffmpeg dão a mesma transformação que a camada de gráficos, frame a frame', () => {
    const items = [stageItem('a', 30, 90, plan('right', { holdExit: true })), stageItem('b', 120, 75, plan('pip-bl', { from: spec('right') }))];
    const placed = placeStages(items, 30);
    const expressions = stageExpressions(placed, W, H);
    for (let frame = 0; frame < 240; frame += 1) {
      const t = frame / 30;
      const active = placed.find((item) => t >= item.start && t < item.end);
      const expected = active ? transformAt(active.plan, t - active.start, active.end - active.start, W, H) : IDENTITY;
      expect(evalExpr(expressions.scale, t)).toBeCloseTo(expected.scale, 3);
      expect(evalExpr(expressions.x, t)).toBeCloseTo(expected.x, 1);
      expect(evalExpr(expressions.y, t)).toBeCloseTo(expected.y, 1);
      expect(evalExpr(expressions.active, t)).toBe(active ? 1 : 0);
    }
  });

  it('um termo parte de `from`, pousa em `to` e volta ao repouso', () => {
    const [stage] = placeStages([stageItem('a', 0, 120, plan('right'))], 30);
    const term = stageTermExpr(stage!, 1, 2, 1);
    expect(evalExpr(term, 0)).toBeCloseTo(0);
    expect(evalExpr(term, 2)).toBeCloseTo(1);
    expect(evalExpr(term, 3.999)).toBeCloseTo(0, 1);
    expect(evalExpr(term, 4)).toBe(0);
  });

  it('reframeFilters é um sub-grafo de uma entrada e uma saída; sem palco, nada', () => {
    expect(reframeFilters([], 1280, 720)).toEqual([]);
    const [filter] = reframeFilters(placeStages([stageItem('a', 30, 90, plan('right'))], 30), 1280, 720);
    expect(filter!.startsWith('split=3[rfa][rfb][rfc];')).toBe(true);
    expect(filter).toContain('drawbox=x=0:y=0:w=iw:h=ih:color=0xf8f8f2:t=fill');
    expect(filter).toContain('eval=frame');
    expect(filter!.endsWith("overlay=enable='gte(t,1)*lt(t,4)'")).toBe(true);
    // rótulos prefixados: não colidem com os dos efeitos nem com os do layout
    expect([...filter!.matchAll(/\[([a-z]+)\]/g)].every((match) => match[1]!.startsWith('rf'))).toBe(true);
  });

  it('WindowStage com gravação de tela vira um segmento de layout no corpo da janela', () => {
    const items: OverlayItem[] = [
      { id: 'w1', component: 'WindowStage', from: 60, durationInFrames: 150, props: { kind: 'screen' }, hidesCaptions: true },
      { id: 'w2', component: 'WindowStage', from: 300, durationInFrames: 90, props: { kind: 'terminal' }, hidesCaptions: true },
    ];
    const layouts = windowLayouts(items, 30);
    expect(layouts).toEqual([{ start: 2, end: 7, mode: 'window', pipCorner: 'bottom-right', rect: windowBodyRect() }]);
    const graph = buildLayoutGraph({ camera: '[camera]', screenInput: 2, layout: layouts, width: 1920, height: 1080, output: '[laid]' }).join(';');
    const body = windowBodyRect();
    expect(graph).toContain('[lwinscr]');
    expect(graph).toContain(`overlay=${Math.round(1920 * body.x)}:${Math.round(1080 * body.y)}:enable='between(t,2.000,7.000)'`);
    // a tela não ocupa o quadro inteiro nesse modo
    expect(graph).toContain("[lcam0][lscr0]overlay=0:0:enable='0'");
    expect(graph.endsWith('[lwinout]null[laid]')).toBe(true);
  });
});

describe('EDL: presenter e wipe', () => {
  it('EDL antiga continua valendo: sem palco e sem rasgo por padrão', () => {
    const edl = edlWith({ overlays: [{ id: 'a', component: 'Callout', at: 5, duration: 2 }] });
    expect(edl.overlays[0]).toMatchObject({ presenter: null, wipe: 'none' });
    const props = buildOverlayProps(edl, buildTimeline(edl.clips, 30), transcript);
    expect(props.overlays[0]!.stage).toBeUndefined();
    expect(props.overlays[0]!.wipe).toBeUndefined();
  });

  it('presenter ganha foco e fundo padrão, e recusa slot desconhecido', () => {
    const edl = edlWith({ overlays: [{ id: 'a', component: 'SplitExplainer', at: 5, duration: 6, presenter: { slot: 'right' } }] });
    expect(edl.overlays[0]!.presenter).toEqual({ slot: 'right', focus: { x: 0.5, y: 0.4 }, backdrop: 'paper' });
    expect(() => edlWith({ overlays: [{ id: 'a', component: 'SplitExplainer', at: 5, duration: 6, presenter: { slot: 'centro' } }] })).toThrow();
    expect(() => edlWith({ overlays: [{ id: 'a', component: 'Callout', at: 5, duration: 6, wipe: 'explosao' }] })).toThrow();
  });

  it('buildOverlayProps liga palcos colados (em frames do vídeo final) e repassa o rasgo', () => {
    const edl = edlWith({
      overlays: [
        { id: 'split', component: 'SplitExplainer', at: 5, duration: 6, presenter: { slot: 'right', focus: { x: 0.4, y: 0.5 } } },
        { id: 'win', component: 'WindowStage', at: 11, duration: 5, presenter: { slot: 'pip-br' } },
        { id: 'cena', component: 'scene:teste/Cena', at: 30, duration: 6, wipe: 'tear' },
      ],
    });
    const props = buildOverlayProps(edl, buildTimeline(edl.clips, 30), transcript);
    const [split, win, scene] = props.overlays;
    expect(split!.stage).toMatchObject({ slot: 'right', from: null, holdExit: true });
    expect(win!.stage).toMatchObject({ slot: 'pip-br', from: { slot: 'right', focus: { x: 0.4, y: 0.5 } }, holdExit: false });
    expect(scene!.stage).toBeUndefined();
    expect(scene!.wipe).toBe('tear');
  });
});

describe('kit do nível max', () => {
  it('parseMarkup separa itálico coral e marca-texto, e deixa marcador sem par como texto', () => {
    expect(parseMarkup('Sem abrir o *terminal.*')).toEqual([{ text: 'Sem abrir o ', style: 'plain' }, { text: 'terminal.', style: 'accent' }]);
    expect(parseMarkup('a ==b c== d')).toEqual([{ text: 'a ', style: 'plain' }, { text: 'b c', style: 'mark' }, { text: ' d', style: 'plain' }]);
    expect(parseMarkup('2 * 3 = 6')).toEqual([{ text: '2 * 3 = 6', style: 'plain' }]);
    expect(parseMarkup('')).toEqual([]);
    expect(plainText('Você personalizava *como* ele ==trabalha==')).toBe('Você personalizava como ele trabalha');
  });

  it('markupWords mantém a ordem, o estilo e as quebras de linha', () => {
    const words = markupWords('Sem abrir\no *terminal agora.*');
    expect(words.map((word) => word.text)).toEqual(['Sem', 'abrir', 'o', 'terminal', 'agora.']);
    expect(words.map((word) => word.style)).toEqual(['plain', 'plain', 'plain', 'accent', 'accent']);
    expect(words.map((word) => word.breakBefore)).toEqual([false, false, true, false, false]);
  });

  it('cueTimes preenche o que falta e nunca volta no tempo', () => {
    expect(cueTimes([undefined, undefined, undefined], 0.5, 1)).toEqual([0.5, 1.5, 2.5]);
    expect(cueTimes([2, undefined, 1, Number.NaN, -3], 0.5, 1)).toEqual([2, 3, 3, 4, 5]);
    expect(cueTimes([], 0.5, 1)).toEqual([]);
  });

  it('cores das pílulas: tokens do tema e texto com contraste', () => {
    expect(pillColors('paper')).toEqual({ background: theme.color.paper, color: theme.color.ink });
    expect(pillColors('coral')).toEqual({ background: theme.color.coral, color: theme.color.ink });
    expect(pillColors('ink').background).toBe(theme.color.ink);
    expect(pillColors('danger').background).toBe(theme.color.coralDeep);
    expect(resolveTone('emerald')).toBe('emerald');
    expect(resolveTone('roxo')).toBe('paper');
    expect(resolveTone(undefined, 'coral')).toBe('coral');
    expect(Math.abs(pillTilt(0))).toBeLessThanOrEqual(1.5);
    // a inclinação é ênfase: igual na pilha, maior na conclusão, alternada só na coluna lateral, reta na árvore
    expect(pillTilt(1)).toBe(pillTilt(0));
    expect(pillTilt(0, 'conclusion')).toBeLessThan(pillTilt(0));
    expect(Math.sign(pillTilt(0, 'side'))).not.toBe(Math.sign(pillTilt(1, 'side')));
    expect(pillTilt(2, 'tree')).toBe(0);
    expect(minReadSec('sem abrir o terminal')).toBeCloseTo(2.2);
  });

  it('PillStack: no máximo 5, última em coral, recuo limitado, saída em ordem inversa', () => {
    const many = stackItems(Array.from({ length: 8 }, (_, index) => ({ text: `ideia ${index}` })));
    expect(many).toHaveLength(MAX_PILLS);
    expect(many.map((pill) => pill.tone)).toEqual(['paper', 'paper', 'paper', 'paper', 'coral']);
    expect(stackItems([{ text: 'uma só' }])[0]!.tone).toBe('paper');
    expect(stackItems([{ text: ' a ', tone: 'danger', indent: 7, strikeAt: 2 }, { text: '   ' }])).toEqual([{ text: 'a', tone: 'danger', at: undefined, strikeAt: 2, indent: 2 }]);
    expect(titleFontSize('mods.')).toBe(208);
    expect(titleFontSize('personalização')).toBeLessThan(208);
    expect(titleFontSize('x'.repeat(200))).toBe(96);
    // 3 pílulas, 90 frames: a de ordem 0 (a mais nova) começa a sair antes
    expect(exitProgress(0, 90, 0, 3, 30)).toBe(0);
    expect(exitProgress(90, 90, 0, 3, 30)).toBe(1);
    expect(exitProgress(86, 90, 0, 3, 30)).toBe(1);
    expect(exitProgress(90, 90, 2, 3, 30)).toBe(1);
    expect(exitProgress(84, 90, 0, 3, 30)).toBeGreaterThan(exitProgress(84, 90, 2, 3, 30));
  });

  it('PhraseReveal: frase curta no tamanho cheio, longa encolhe até o piso', () => {
    expect(phraseFontSize('Sem abrir\no *terminal.*')).toBe(PHRASE_MAX);
    expect(phraseFontSize('Uma frase bem mais comprida do que cabe ao lado do rosto')).toBeLessThan(PHRASE_MAX);
    expect(phraseFontSize('x'.repeat(400))).toBe(72);
  });

  it('SplitExplainer: até 3 por linha, cartões depois do título ou no tempo dado', () => {
    expect([0, 1, 2, 3, 4, 6].map(cardColumns)).toEqual([1, 1, 2, 3, 3, 3]);
    expect(explainerTitleSize('Você personalizava *como* ele trabalha')).toBeLessThanOrEqual(TITLE_MAX);
    expect(explainerTitleSize('Curto')).toBe(TITLE_MAX);
    expect(explainerTitleSize('x'.repeat(300))).toBe(64);
    const auto = cardTimes(3, 5);
    expect(auto[0]).toBeGreaterThan(TITLE_START + 0.5);
    expect(auto[1]! - auto[0]!).toBeCloseTo(1.2);
    expect(cardTimes(3, 5, [2, 3.5, 5])).toEqual([2, 3.5, 5]);
  });

  it('WindowStage: prompt é digitado, o resto surge inteiro; o zoom ancora no alvo', () => {
    expect(typedLength('npm run dev', 'prompt', -1)).toBe(0);
    expect(typedLength('npm run dev', 'prompt', TYPE_SEC / 2)).toBeGreaterThan(3);
    expect(typedLength('npm run dev', 'prompt', TYPE_SEC / 2)).toBeLessThan(11);
    expect(typedLength('npm run dev', 'prompt', 5)).toBe(11);
    expect(typedLength('pronto', 'ok', 0)).toBe(6);
    expect(lineTone('ok')).toBe('ok');
    expect(lineTone('nada')).toBe('output');
    expect(pushAt(normalizePushes(undefined, 9), 5)).toEqual({ scale: 1, tx: 0, ty: 0 });
    const pushed = pushAt(normalizePushes({ at: 1, scale: 1.3, x: 0.2, y: 0.3 }, 9), 8);
    expect(pushed.scale).toBeCloseTo(1.3);
    // o ponto-âncora não sai do lugar: 0,2 × 1,3 + tx = 0,2
    expect(0.2 * pushed.scale + pushed.tx).toBeCloseTo(0.2);
    expect(0.3 * pushed.scale + pushed.ty).toBeCloseTo(0.3);
    expect(normalizePushes({ at: 1, scale: 9 }, 9)[0]!.scale).toBe(3);
  });

  it('DocQuote: citação longa encolhe e o marca-texto tem instante padrão', () => {
    expect(quoteFontSize('curta')).toBe(40);
    expect(quoteFontSize('x'.repeat(2000))).toBe(30);
    expect(markStart(undefined)).toBe(1.2);
    expect(markStart(3)).toBe(3);
    expect(markStart(-1)).toBe(1.2);
    expect(typeof DocQuote).toBe('function');
  });

  it('os cinco componentes estão no arsenal, com sample e descrição; os de tela cheia são opacos', () => {
    const entries = { PillStack: pillStack, PhraseReveal: phraseReveal, SplitExplainer: splitExplainer, WindowStage: windowStage, DocQuote: docQuote };
    const listed = catalog('components').map((item) => item.id);
    for (const [name, entry] of Object.entries(entries)) {
      expect(registry[name]).toBe(entry);
      expect(listed).toContain(name);
      expect(entry.defaultDuration).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(40);
      expect(Object.keys(entry.sample).length).toBeGreaterThan(0);
    }
    expect(splitExplainer.opaque).toBe(true);
    expect(windowStage.opaque).toBe(true);
    expect(docQuote.opaque).toBeUndefined();
  });
});

describe('padrões obrigatórios do nível max', () => {
  it('só o max exige; cada padrão aponta para algo que existe', () => {
    for (const level of LEVEL_IDS) expect(LEVELS[level].required).toEqual(level === 'max' ? MAX_PATTERNS : []);
    expect(new Set(MAX_PATTERNS.map((pattern) => pattern.id)).size).toBe(MAX_PATTERNS.length);
    for (const pattern of MAX_PATTERNS) {
      expect(Boolean(pattern.components?.length) !== Boolean(pattern.feature)).toBe(true);
      for (const component of pattern.components ?? []) expect(registry[component]).toBeDefined();
      expect((pattern.minPerMinute ?? 0) > 0 || (pattern.minPerVideo ?? 0) > 0).toBe(true);
      expect(pattern.when.length).toBeGreaterThan(10);
      expect(pattern.how.length).toBeGreaterThan(10);
    }
    expect(LEVELS.max.limits.maxIdleSec).toBe(8);
    expect(LEVELS.pro.limits.maxIdleSec).toBeNull();
  });

  it('os mínimos somados cabem no orçamento de gráficos do nível', () => {
    const components = MAX_PATTERNS.filter((pattern) => pattern.components).reduce((sum, pattern) => sum + (pattern.minPerMinute ?? 0), 0);
    expect(components).toBeLessThanOrEqual(LEVELS.max.perMinute.graphics.max);
    expect(components).toBeLessThanOrEqual(60 / LEVELS.max.limits.graphicMinGapSec);
  });

  it('requiredCount: por minuto arredonda para baixo, mas obrigatório é pelo menos 1', () => {
    const pills = MAX_PATTERNS.find((pattern) => pattern.id === 'pilulas')!;
    const doc = MAX_PATTERNS.find((pattern) => pattern.id === 'citacao-marca-texto')!;
    expect(requiredCount(pills, 600)).toBe(15);
    expect(requiredCount(pills, 20)).toBe(1);
    expect(requiredCount(doc, 3600)).toBe(1);
    expect(formatMinimum(pills)).toBe('≥ 1.5/min');
    expect(formatMinimum(doc)).toBe('≥ 1/vídeo');
  });

  const full = [
    { id: 'p1', component: 'PillStack', at: 2, duration: 5, reason: 'resumo', props: { items: [{ text: 'a', at: 1 }, { text: 'b', at: 3 }] } },
    { id: 'p2', component: 'PillStack', at: 40, duration: 5, reason: 'resumo' },
    { id: 'p3', component: 'PillStack', at: 100, duration: 5, reason: 'resumo' },
    { id: 'f1', component: 'PhraseReveal', at: 8, duration: 4, reason: 'tese' },
    { id: 'e1', component: 'SplitExplainer', at: 14, duration: 8, reason: 'enumeração', presenter: { slot: 'right' }, hidesCaptions: true },
    { id: 'w1', component: 'WindowStage', at: 22, duration: 8, reason: 'demo', presenter: { slot: 'pip-br' }, hidesCaptions: true },
    { id: 'd1', component: 'DocQuote', at: 30, duration: 6, reason: 'fonte', presenter: { slot: 'pip-br' } },
    { id: 's1', component: 'scene:teste/Cena', at: 48, duration: 6, reason: 'conceito', wipe: 'tear', hidesCaptions: true },
  ];

  it('countPattern conta por componente, por palco e por rasgo', () => {
    const edl = edlWith({ level: 'max', overlays: full });
    const counts = Object.fromEntries(MAX_PATTERNS.map((pattern) => [pattern.id, countPattern(edl, pattern)]));
    expect(counts).toEqual({ pilulas: 3, 'frase-serifada': 1, 'apresentador-em-cartao': 3, 'explicacao-dividida': 1, 'janela-flutuante': 1, 'rasgo-de-papel': 1, 'citacao-marca-texto': 1 });
  });

  it('buildRequired e judgeRequired dizem quantos faltam e como montar', () => {
    const empty = edlWith({ level: 'max' });
    const rows = buildRequired(empty, 120, LEVELS.max);
    expect(rows.map((row) => row.min)).toEqual([3, 1, 2, 1, 1, 1, 1]);
    const findings = judgeRequired(rows, LEVELS.max);
    expect(findings).toHaveLength(7);
    expect(findings[0]).toMatchObject({ severity: 'warning', check: 'padrao-obrigatorio', message: 'pílulas de resumo: 0 de 3 (obrigatório no nível max)' });
    expect(findings[0]!.fix).toContain('adicione 3: { "component": "PillStack"');
    expect(buildRequired(empty, 120, LEVELS.pro)).toEqual([]);

    const done = edlWith({ level: 'max', overlays: full });
    const left = judgeRequired(buildRequired(done, 120, LEVELS.max), LEVELS.max);
    expect(left).toEqual([]);
  });

  it('lintStyle só cobra os padrões no max', () => {
    const checks = (level: string) => {
      const edl = edlWith({ level });
      return lintStyle(edl, buildTimeline(edl.clips, 30)).map((finding) => finding.check);
    };
    expect(checks('max').filter((check) => check === 'padrao-obrigatorio')).toHaveLength(7);
    for (const level of ['limpa', 'normal', 'pro']) {
      expect(checks(level)).not.toContain('padrao-obrigatorio');
      expect(checks(level)).not.toContain('tela-parada');
    }
  });

  it('formatLevels e formatBudget mostram os padrões só onde existem', () => {
    expect(formatLevels('max')).toContain('padrões obrigatórios:');
    expect(formatLevels('max')).toMatch(/pílulas de resumo\s+≥ 1\.5\/min/);
    expect(formatLevels('max')).toContain('tela parada: no máximo 8s');
    expect(formatLevels('pro')).not.toContain('padrões obrigatórios');
    const edl = edlWith({ level: 'max', overlays: full.slice(0, 2) });
    const text = formatBudget(LEVELS.max, 120, buildBudget(edl, 120, LEVELS.max), false, buildRequired(edl, 120, LEVELS.max));
    expect(text).toMatch(/pílulas de resumo\s+2\s+3\s+faltam 1/);
    expect(text).toMatch(/frase serifada\s+0\s+1\s+faltam 1/);
    expect(formatBudget(LEVELS.pro, 120, buildBudget(edl, 120, LEVELS.pro), false)).not.toContain('padrões obrigatórios');
  });
});

describe('tela parada e legenda sobre palco', () => {
  it('overlayCues acha os instantes internos de qualquer componente', () => {
    expect(overlayCues({ items: [{ text: 'a', at: 1 }, { text: 'b', at: 3, strikeAt: 4 }], revealAt: [2, 5], markAt: 6, note: { text: 'n', at: 7 }, title: 'x', wordAt: [0.5] })).toEqual([0.5, 1, 2, 3, 4, 5, 6, 7]);
    expect(overlayCues({ items: ['a', 'b'], values: [1, 2, 3], at: -1 })).toEqual([]);
  });

  it('visualEvents junta overlays (com itens internos), zooms, efeitos curtos e transições no tempo final', () => {
    const edl = edlWith({
      overlays: [{ id: 'p', component: 'PillStack', at: 10, duration: 6, props: { items: [{ text: 'a', at: 1 }, { text: 'b', at: 9 }] } }],
      zooms: [{ id: 'z', at: 80, duration: 2 }],
      effects: [
        { id: 'look', preset: 'look-warm-editorial', at: 0 },
        { id: 'fx', preset: 'texture-scanlines', at: 30 },
      ],
      transitions: [{ id: 't', intoClip: 'c2', type: 'wipe' }],
    });
    // o item em 9s fica fora do overlay de 6s; o look de vídeo inteiro não conta; 80s da fonte = 70s do vídeo
    expect(visualEvents(edl, buildTimeline(edl.clips, 30))).toEqual([10, 11, 16, 30, 60, 70]);
  });

  it('idleGaps acusa só os intervalos acima do teto, incluindo o começo e o fim', () => {
    expect(idleGaps([5, 9, 30], 40, 8)).toEqual([{ from: 9, to: 30 }, { from: 30, to: 40 }]);
    expect(idleGaps([], 6, 8)).toEqual([]);
    expect(idleGaps([8], 16, 8)).toEqual([]);
  });

  it('lintStyle avisa tela-parada no max e legenda-sobre-palco em cartão lateral', () => {
    const overlays = [
      { id: 'e1', component: 'SplitExplainer', at: 4, duration: 6, reason: 'enumeração', presenter: { slot: 'right' } },
      { id: 'd1', component: 'DocQuote', at: 12, duration: 6, reason: 'fonte', presenter: { slot: 'pip-br' } },
    ];
    const edl = edlWith({ level: 'max', overlays });
    const findings = lintStyle(edl, buildTimeline(edl.clips, 30));
    const stage = findings.filter((finding) => finding.check === 'legenda-sobre-palco');
    expect(stage).toHaveLength(1);
    expect(stage[0]!.message).toContain('"e1"');
    const idle = findings.filter((finding) => finding.check === 'tela-parada');
    expect(idle).toHaveLength(1);
    expect(idle[0]!.at).toBe(18);
    expect(idle[0]!.message).toContain('102.0s sem nada novo');
  });
});
