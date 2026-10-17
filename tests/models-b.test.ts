import { describe, expect, it } from 'vitest';

import { orbitPose, projectToScreen } from '../motion/src/scene-kit/voxel/camera.ts';
import { CAPTION_ZONE } from '../motion/src/scene-kit/tokens.ts';
import {
  cycleCaptionFont,
  cycleLabelFont,
  cycleLayout,
  cyclePoint,
  cycleTimes,
  meterFill,
  meterMaxOf,
  meterNumber,
  STALL_LEVEL,
  stallAttempt,
} from '../motion/src/scenes/modelos/CicloDeDoisPassos.tsx';
import { badgeFlip, badgeLayout, badgeX, ITEM_RANGE, roleFontSize, UNLOCK_DELAY, unlockTimes } from '../motion/src/scenes/modelos/CrachaComDesbloqueios.tsx';
import { hop, markerAt, signSize, stairLayout, stairTimes, stairTitle, STEP_RANGE, stepText } from '../motion/src/scenes/modelos/EscadaComProximoDegrau.tsx';
import { pulse, strikeLine, swapLayout, swapStackHeight, swapTimes, swapTitleFont } from '../motion/src/scenes/modelos/EtiquetaRiscadaETrocada.tsx';
import { clampCount, estimateLines, estimateWidth, fillTimes, fitFontSize, pillHeight, pillWidth } from '../motion/src/scenes/modelos/fit-b.ts';
import {
  BREAK_FRAMES,
  DEEP_X,
  DIG_RANGE,
  digCount,
  digPlan,
  digTimes,
  dugCount,
  labelAnchors,
  oreFrame,
  orePosition,
  tooltipWidth,
  WALL,
  WIDE_FROM_X,
  worldBlocks,
} from '../motion/src/scenes/modelos/largo-fundo-logic.ts';
import { BUBBLE_RANGE, BUBBLE_STAGGER, bubblePosition, bubbleRoom, callLayout, callTimes, lineFont, thoughtFont } from '../motion/src/scenes/modelos/PensamentoViraChamada.tsx';
import { theme } from '../motion/src/theme.ts';
import { loadScenes, modelProblems, modelsOf, sceneLinks } from '../src/scenes/models.ts';

const USABLE_WIDTH = 1920 - theme.safe.x * 2;
const USABLE_HEIGHT = 1080 - theme.safe.y - CAPTION_ZONE;

const MODELS: Record<string, string> = {
  CicloDeDoisPassos: 'como-melhorei/EstudarEPraticar',
  EscadaComProximoDegrau: 'como-melhorei/NaoAcabou',
  CrachaComDesbloqueios: 'como-melhorei/Embaixador',
  PensamentoViraChamada: 'como-melhorei/MentoriaAoVivo',
  EtiquetaRiscadaETrocada: 'como-melhorei/DeCoracao',
  LargoVersusFundo: 'teste-fullstack/ProfundidadeVsLargura',
};

describe('modelos B: contrato e vínculo com as cenas de origem', () => {
  const scenes = loadScenes();
  const models = modelsOf(scenes);
  const links = sceneLinks(scenes);

  it.each(Object.entries(MODELS))('%s está completo e a cena %s aponta para ele', (name, origin) => {
    const model = models.find((item) => item.name === name)!;
    expect(model, name).toBeDefined();
    expect(modelProblems(model)).toEqual([]);
    expect(model.origin?.scene).toBe(origin);
    expect(links[origin]).toBe(name);
    // o sample é de outro assunto: nada do vídeo de origem
    expect(JSON.stringify(model.sample)).not.toMatch(/Campus|Alumni|Embaixador|Mentor|Patrocinad|Estudar|Praticar|Profundidade/i);
  });

  it('todo tempo do sample cabe na duração e vem em ordem dentro de cada lista', () => {
    for (const name of Object.keys(MODELS)) {
      const model = models.find((item) => item.name === name)!;
      const reveal = (model.sample as { revealAt: Record<string, number | number[]> }).revealAt;
      for (const value of Object.values(reveal)) {
        const times = Array.isArray(value) ? value : [value];
        expect([...times].sort((a, b) => a - b), name).toEqual(times);
        for (const time of times) expect(time, name).toBeLessThan(model.defaultDuration!);
      }
    }
  });
});

describe('fit-b: estimativas de texto', () => {
  it('largura cresce com o texto e com a fonte; fitFontSize respeita o piso e o teto', () => {
    expect(estimateWidth('abcd', 50)).toBeCloseTo(116);
    expect(estimateWidth('', 50)).toBe(0);
    expect(fitFontSize('curto', 1000, 48, 36)).toBe(48);
    expect(fitFontSize('um texto bem mais comprido que a caixa', 300, 48, 36)).toBe(36);
    const middle = fitFontSize('doze letras!', 300, 48, 36);
    expect(middle).toBeGreaterThan(36);
    expect(middle).toBeLessThan(48);
    expect(estimateWidth('doze letras!', middle)).toBeLessThanOrEqual(300);
    expect(fitFontSize('', 300, 48, 36)).toBe(48);
  });

  it('linhas por palavras, pílula do kit e preenchimento de tempos', () => {
    expect(estimateLines('uma duas tres', 10_000, 40)).toBe(1);
    expect(estimateLines('uma duas tres', 100, 40)).toBe(3);
    expect(estimateLines('', 100, 40)).toBe(1);
    expect(pillHeight(46)).toBe(96);
    expect(pillWidth('abc', 40, 'icon')).toBeGreaterThan(pillWidth('abc', 40, 'dot'));
    expect(pillWidth('abc', 40, 'dot')).toBeGreaterThan(pillWidth('abc', 40));
    expect(fillTimes(4, [2, undefined, 5], 1, 0.5)).toEqual([2, 2.5, 5, 5.5]);
    expect(fillTimes(2, [], 1, 0.5)).toEqual([1, 1.5]);
    expect(fillTimes(0)).toEqual([]);
    expect(clampCount(9.7, 2, 5)).toBe(5);
    expect(clampCount(0, 2, 5)).toBe(2);
  });
});

describe('CicloDeDoisPassos', () => {
  const layout = cycleLayout(USABLE_WIDTH);

  it('tempos: aceita os da cena de origem e completa os que faltam em sequência', () => {
    expect(cycleTimes({ first: 1.2, stall: 3.4, second: 6.4, loop: 7.6 })).toEqual({ first: 1.2, stall: 3.4, second: 6.4, loop: 7.6 });
    expect(cycleTimes()).toEqual({ first: 1.2, stall: 3.4, second: 6.4, loop: 7.6 });
    const partial = cycleTimes({ first: 2, second: 9 });
    expect(partial).toEqual({ first: 2, stall: 4.2, second: 9, loop: 10.2 });
  });

  it('layout: rótulos dos dois passos e o medidor não se encostam e a pilha cabe na área útil', () => {
    const half = layout.labelWidth / 2;
    expect(layout.first[0] - half).toBeGreaterThanOrEqual(0);
    expect(layout.first[0] + half).toBeLessThanOrEqual(layout.second[0] - half);
    expect(layout.second[0] + half).toBeLessThanOrEqual(layout.meter.x);
    expect(layout.meter.x + layout.meter.width).toBeLessThanOrEqual(USABLE_WIDTH);
    expect(layout.stop.x).toBeLessThan(layout.second[0] - layout.badge / 2);
    // eyebrow + gap + palco + gap + frase
    expect(41 + 44 + layout.height + 44 + 100).toBeLessThanOrEqual(USABLE_HEIGHT);
  });

  it('textos: os da cena de origem ficam no tamanho cheio; os de outro assunto, mais longos, encolhem sem passar de duas linhas', () => {
    for (const label of ['Estudar', 'Praticar', 'Treinar', 'Descansar']) expect(cycleLabelFont(label)).toBe(48);
    const long = 'Revisar o código dos outros';
    expect(cycleLabelFont(long)).toBe(36);
    expect(estimateLines(long, layout.labelWidth, cycleLabelFont(long))).toBeLessThanOrEqual(2);
    for (const caption of ['Estudar e praticar: o nível sobe.', 'Treinar e descansar: a força sobe.']) {
      expect(cycleCaptionFont(caption, USABLE_WIDTH)).toBe(72);
    }
    const longCaption = 'Medir sem ajustar não muda nada: é o ajuste que faz o número subir de verdade.';
    const font = cycleCaptionFont(longCaption, USABLE_WIDTH);
    expect(font).toBeLessThan(72);
    expect(font).toBeGreaterThanOrEqual(48);
  });

  it('medidor: estaciona enquanto o passo está sozinho e enche quando o ciclo fecha', () => {
    const times = cycleTimes();
    expect(meterFill(0, times)).toBe(0);
    expect(meterFill(times.stall, times)).toBeCloseTo(STALL_LEVEL);
    expect(meterFill(times.second, times)).toBeCloseTo(STALL_LEVEL);
    expect(meterFill(times.loop + 2, times)).toBeCloseTo(1);
    let previous = 0;
    for (let sec = 0; sec <= 10; sec += 0.1) {
      const fill = meterFill(sec, times);
      expect(fill).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = fill;
    }
    expect(meterMaxOf(undefined)).toBe(5);
    expect(meterMaxOf(12)).toBe(9);
    expect(meterMaxOf(1)).toBe(2);
    expect(meterNumber(1, 9)).toBe(9);
    expect(meterNumber(STALL_LEVEL, 5)).toBe(1);
    expect(meterNumber(-1, 5)).toBe(0);
  });

  it('ciclo e tentativa: o ponto vai pelo arco de cima, volta pelo de baixo e a tentativa some no bloqueio', () => {
    expect(cyclePoint(0, layout)).toEqual(layout.go.from);
    expect(cyclePoint(0.5, layout)).toEqual(layout.back.from);
    expect(cyclePoint(0.25, layout)[1]).toBeLessThan(layout.go.from[1]);
    expect(cyclePoint(0.75, layout)[1]).toBeGreaterThan(layout.back.from[1]);
    expect(cyclePoint(-0.75, layout)).toEqual(cyclePoint(0.25, layout));
    expect(stallAttempt(1, 2)).toEqual({ travel: 0, opacity: 0 });
    expect(stallAttempt(2 + 1.3 * 0.7, 2).travel).toBe(1);
    expect(stallAttempt(2 + 1.3 * 0.97, 2).opacity).toBe(0);
  });
});

describe('EscadaComProximoDegrau', () => {
  const origin = [{ label: 'Aluno' }, { label: 'Campus Expert' }, { label: 'Alumni', hint: 'A turma de quem já se formou.' }];
  const other = [{ label: 'Estagiário' }, { label: 'Júnior' }, { label: 'Pleno' }, { label: 'Sênior' }, { label: 'Staff', hint: 'Onde a régua muda de novo.' }];

  it('tempos: os da cena de origem passam direto; sem nada, o último degrau nasce depois do risco', () => {
    expect(stairTimes(3, { steps: [0.4, 1.4, 5.6], end: 3, strike: 4.4 })).toEqual({ steps: [0.4, 1.4, 5.6], end: 3, strike: 4.4 });
    expect(stairTimes(3)).toEqual({ steps: [0.4, 1.4, 5.6], end: 3, strike: 4.4 });
    const five = stairTimes(5);
    expect(five.steps.slice(0, 4)).toEqual([0.4, 1.4, 2.4, 3.4]);
    expect(five.end).toBeGreaterThan(five.steps[3]!);
    expect(five.strike).toBeGreaterThan(five.end);
    expect(five.steps[4]).toBeGreaterThan(five.strike);
    expect(stairTimes(2, { steps: [1] }).steps).toHaveLength(2);
  });

  it.each([2, 3, 4, 5])('layout com %i degraus: sobe para a direita e tudo fica dentro da área útil', (count) => {
    const layout = stairLayout(count, USABLE_WIDTH, USABLE_HEIGHT);
    expect(layout.count).toBe(count);
    expect(layout.steps).toHaveLength(count);
    layout.steps.forEach((step, index) => {
      expect(step.x).toBeGreaterThanOrEqual(0);
      expect(step.top).toBeGreaterThan(0);
      expect(step.top + step.height).toBe(layout.baseline);
      if (index > 0) {
        expect(step.x).toBeGreaterThanOrEqual(layout.steps[index - 1]!.x + layout.steps[index - 1]!.width);
        expect(step.height).toBeGreaterThan(layout.steps[index - 1]!.height);
      }
      const [x, y] = layout.anchors[index]!;
      expect(x - layout.marker / 2).toBeGreaterThanOrEqual(step.x);
      expect(x + layout.marker / 2).toBeLessThanOrEqual(step.x + step.width);
      expect(y + layout.marker / 2).toBeLessThan(step.top);
    });
    const before = layout.steps[count - 2]!;
    expect(layout.sign.centerX - layout.sign.maxWidth / 2).toBeGreaterThanOrEqual(before.x);
    expect(layout.sign.centerX + layout.sign.maxWidth / 2).toBeLessThanOrEqual(before.x + before.width);
    expect(layout.sign.maxWidth).toBeGreaterThanOrEqual(190);
    expect(layout.trail.to[0]).toBeLessThanOrEqual(USABLE_WIDTH);
    expect(layout.trail.to[1]).toBeGreaterThan(0);
    expect(layout.trail.label[0] + pillWidth('e continua', 36, 'dot') / 2).toBeLessThanOrEqual(USABLE_WIDTH);
    expect(layout.title.maxWidth).toBeGreaterThanOrEqual(600);
    expect(layout.title.maxHeight).toBeGreaterThanOrEqual(183);
    expect(layout.baseline).toBeLessThan(USABLE_HEIGHT);
  });

  it('com 3 degraus reproduz a escada da cena de origem; fora do intervalo, limita', () => {
    const layout = stairLayout(3, 1728, 836);
    expect(layout.steps.map((step) => [step.x, step.width, step.height])).toEqual([
      [40, 420, 170],
      [480, 420, 310],
      [920, 420, 450],
    ]);
    expect(layout.anchors[0]).toEqual([150, 810 - 170 - 12 - 42]);
    expect(layout.sign.post).toBe(40);
    expect(stairLayout(9).count).toBe(STEP_RANGE.max);
    expect(stairLayout(1).count).toBe(STEP_RANGE.min);
  });

  it.each([
    ['cena de origem (3 degraus)', origin, 'Fim?', 'Nada disso.', 'A trilha'],
    ['outro assunto (5 degraus, textos mais longos)', other, 'Topo?', 'Ainda falta um degrau inteiro.', 'A carreira'],
    ['dois degraus', [{ label: 'Versão 1' }, { label: 'Versão 2', hint: 'A que resolve o que faltava.' }], 'Pronto?', 'Quase.', ''],
  ])('%s: texto dos degraus, placa e frase cabem', (_name, steps, endLabel, title, eyebrow) => {
    const layout = stairLayout(steps.length, USABLE_WIDTH, USABLE_HEIGHT);
    steps.forEach((step, index) => {
      const stair = layout.steps[index]!;
      const fit = stepText(step, stair, layout.padX);
      expect(fit.fontSize).toBeGreaterThanOrEqual(36);
      expect(fit.height, step.label).toBeLessThanOrEqual(stair.height);
      // nenhuma palavra sozinha é mais larga que o degrau
      for (const word of step.label.split(' ')) expect(estimateWidth(word, fit.fontSize, 'display')).toBeLessThanOrEqual(stair.width - layout.padX * 2);
    });
    expect(stepText(steps.at(-1)!, layout.steps.at(-1)!, layout.padX).showHint).toBe(true);
    const sign = signSize(endLabel, layout.sign.maxWidth);
    expect(sign.fontSize).toBeGreaterThanOrEqual(34);
    expect(sign.width).toBeLessThanOrEqual(layout.sign.maxWidth);
    const heading = stairTitle(title, layout.title.maxWidth, layout.title.maxHeight, Boolean(eyebrow));
    expect(heading.fontSize).toBeGreaterThanOrEqual(60);
    expect(heading.height).toBeLessThanOrEqual(layout.title.maxHeight);
  });

  it('degrau baixo esconde a linha de apoio em vez de estourar', () => {
    const layout = stairLayout(3);
    const fit = stepText({ label: 'Começo', hint: 'Uma linha de apoio que não cabe aqui.' }, layout.steps[0]!, layout.padX);
    expect(fit.showHint).toBe(false);
    expect(fit.height).toBeLessThanOrEqual(layout.steps[0]!.height);
  });

  it('marcador: parado no primeiro degrau, pula para cada degrau quando ele nasce e termina no último', () => {
    const layout = stairLayout(4);
    const times = stairTimes(4).steps;
    expect(markerAt(0, 30, times, layout.anchors)).toEqual(layout.anchors[0]);
    expect(markerAt(Math.round((times[1]! + 2) * 30), 30, times, layout.anchors.slice(0, 2), layout.arc)).toEqual(layout.anchors[1]);
    expect(markerAt(30 * 60, 30, times, layout.anchors, layout.arc)).toEqual(layout.anchors[3]);
    const mid = markerAt(Math.round((times[1]! + 0.5) * 30), 30, times, layout.anchors, layout.arc);
    expect(mid[0]).toBeGreaterThan(layout.anchors[0]![0]);
    expect(mid[0]).toBeLessThan(layout.anchors[1]![0]);
    expect(mid[1]).toBeLessThan(layout.anchors[0]![1]);
    expect(hop([0, 0], [100, -50], 0.5, 70)).toEqual([50, -95]);
    expect(hop([0, 0], [100, -50], 2)[0]).toBe(100);
  });
});

describe('CrachaComDesbloqueios', () => {
  const origin = ['Mentorias', 'Competições', 'Comunidade'];
  const other = ['Revisão de código toda semana', 'Acesso ao repositório privado', 'Canal direto com o time', 'Ingresso do evento anual', 'Desconto em cursos', 'Selo no perfil'];

  it('tempos: os da cena de origem passam direto e cada item destrava logo depois de aparecer', () => {
    const times = unlockTimes(3, { badge: 0.5, title: 2.8, items: [4.4, 5.2, 5.8] });
    expect(times.items).toEqual([4.4, 5.2, 5.8]);
    expect(times.unlocks).toEqual([4.7, 5.5, 6.1]);
    expect(UNLOCK_DELAY).toBe(0.3);
    const defaults = unlockTimes(5);
    expect(defaults.badge).toBe(0.5);
    expect(defaults.title).toBe(2.8);
    expect(defaults.items).toHaveLength(5);
    expect(defaults.items[0]).toBeCloseTo(4.4);
    expect([...defaults.items].sort((a, b) => a - b)).toEqual(defaults.items);
    expect(unlockTimes(20).items).toHaveLength(ITEM_RANGE.max);
    expect(unlockTimes(2, { items: [6] }).items).toEqual([6, 6.7]);
  });

  it('com os 3 itens da cena de origem reproduz o layout dela', () => {
    const layout = badgeLayout(origin, 1, 1728, 836);
    expect(layout.row).toEqual({ height: 108, gap: 22, indent: 56, fontSize: 46, icon: 76 });
    expect(layout.badge).toMatchObject({ width: 540, height: 620, restX: 70, centerX: 594 });
    expect(layout.column.x).toBe(720);
    expect(badgeX(layout, 0)).toBe(594);
    expect(badgeX(layout, 1)).toBe(70);
  });

  it.each([
    ['cena de origem', origin, 1],
    ['outro assunto, 6 itens longos e título em duas linhas', other, 2],
    ['um item só', ['Acesso antecipado'], 1],
    ['quatro itens e título em três linhas', ['Deploy sem limite', 'Domínio próprio', 'Suporte prioritário', 'Relatórios semanais'], 3],
  ])('%s: a coluna cabe na área útil, ao lado do crachá', (_name, items, titleLines) => {
    const layout = badgeLayout(items, titleLines, USABLE_WIDTH, USABLE_HEIGHT);
    expect(layout.count).toBe(items.length);
    expect(layout.row.fontSize).toBeGreaterThanOrEqual(34);
    expect(layout.row.height).toBeGreaterThanOrEqual(76);
    expect(layout.row.indent).toBeGreaterThanOrEqual(0);
    expect(layout.column.top).toBeGreaterThanOrEqual(0);
    expect(layout.column.top + layout.column.height).toBeLessThanOrEqual(USABLE_HEIGHT);
    expect(layout.column.x).toBeGreaterThan(layout.badge.restX + layout.badge.width);
    expect(layout.column.x + layout.column.width).toBeLessThanOrEqual(USABLE_WIDTH);
    for (const width of layout.rowWidths) expect(width).toBeLessThanOrEqual(layout.column.width);
    expect(layout.badge.top).toBeGreaterThanOrEqual(0);
    expect(layout.badge.top + layout.badge.height).toBeLessThanOrEqual(USABLE_HEIGHT);
  });

  it('mais itens que o limite são cortados; a linha encolhe conforme a quantidade', () => {
    expect(badgeLayout([...other, 'a mais', 'outro']).count).toBe(ITEM_RANGE.max);
    expect(badgeLayout(other, 2).row.height).toBeLessThan(badgeLayout(origin, 2).row.height);
    expect(badgeLayout(['Só um']).row.indent).toBe(0);
  });

  it('crachá: vira de costas para frente e o título longo encolhe', () => {
    expect(badgeFlip(0)).toEqual({ angle: 180, front: false });
    expect(badgeFlip(0.5).front).toBe(false);
    expect(badgeFlip(0.51).front).toBe(true);
    expect(badgeFlip(2)).toEqual({ angle: 0, front: true });
    expect(roleFontSize('Embaixador universitário')).toBe(58);
    expect(roleFontSize('Assinante anual')).toBe(58);
    expect(roleFontSize('Pessoa desenvolvedora responsável pela plataforma inteira')).toBe(46);
  });
});

describe('PensamentoViraChamada', () => {
  it('tempos: os da cena de origem dão os mesmos balões; por índice, o diretor manda em cada um', () => {
    const times = callTimes(3, { thought: 0.3, call: 2.6, live: 4.2, closing: 5.6 });
    expect(times.bubbles).toHaveLength(3);
    times.bubbles.forEach((time, index) => expect(time).toBeCloseTo(4.2 + 0.15 + index * BUBBLE_STAGGER));
    expect(times.closing).toBe(5.6);
    expect(callTimes(2, { bubbles: [5, 7] }).bubbles).toEqual([5, 7]);
    const defaults = callTimes(4);
    expect(defaults.thought).toBe(0.3);
    expect(defaults.call).toBeCloseTo(2.6);
    expect(defaults.live).toBeCloseTo(4.2);
    expect(defaults.closing).toBeGreaterThan(defaults.bubbles.at(-1)!);
    expect(callTimes(9).bubbles).toHaveLength(BUBBLE_RANGE.max);
  });

  it.each([1, 2, 3, 4])('layout com %i balões: faixas dentro dos quadros, janela dentro da área útil', (count) => {
    const layout = callLayout(USABLE_WIDTH, count);
    expect(layout.lanes).toHaveLength(count);
    const half = pillHeight(34) / 2;
    for (const lane of layout.lanes) {
      expect(lane - half).toBeGreaterThanOrEqual(layout.tile.y + 16);
      expect(lane + half).toBeLessThanOrEqual(layout.tile.y + layout.tile.height - 16);
    }
    for (let index = 1; index < count; index += 1) expect(layout.lanes[index]! - layout.lanes[index - 1]!).toBeGreaterThanOrEqual(pillHeight(34));
    expect(layout.window.x).toBeGreaterThanOrEqual(0);
    expect(layout.window.x + layout.window.width).toBeLessThanOrEqual(USABLE_WIDTH);
    expect(layout.closingY + 88 * 1.12).toBeLessThanOrEqual(layout.height);
    expect(layout.height).toBeLessThanOrEqual(USABLE_HEIGHT);
    expect(layout.travel.fromX).toBeGreaterThan(layout.left[0] + layout.avatar / 2);
    expect(layout.travel.toX).toBeLessThan(layout.right[0] - layout.avatar / 2);
  });

  it('com 3 faixas reproduz a janela da cena de origem; fora do intervalo, limita', () => {
    const layout = callLayout(1728, 3);
    expect(layout.window).toEqual({ x: 164, y: 150, width: 1400, height: 500 });
    expect(layout.lanes).toEqual([184, 284, 384]);
    expect(callLayout(1728, 9).lanes).toHaveLength(BUBBLE_RANGE.max);
    expect(callLayout(1728, 0).lanes).toHaveLength(BUBBLE_RANGE.min);
  });

  it('balão: sai encostado em quem fala e chega encostado em quem ouve', () => {
    const { travel } = callLayout();
    expect(bubblePosition(0, 'left', travel)).toEqual({ left: travel.fromX, shift: -0 });
    expect(bubblePosition(1, 'left', travel)).toEqual({ left: travel.toX, shift: -100 });
    expect(bubblePosition(0, 'right', travel)).toEqual({ left: travel.toX, shift: -100 });
    expect(bubblePosition(1, 'right', travel).left).toBe(travel.fromX);
  });

  it('textos da cena de origem e de outro assunto cabem; balão comprido demais quase não anda', () => {
    const { travel } = callLayout();
    for (const label of ['feedback', 'minha dúvida', 'direção', 'o que você precisa?', 'um app de pedidos', 'três semanas']) expect(bubbleRoom(label, travel)).toBeGreaterThan(300);
    expect(bubbleRoom('uma resposta comprida demais para caber num balão que ainda precisa atravessar', travel)).toBeLessThan(120);
    expect(thoughtFont('Conhecer ela? Nunca imaginei.')).toMatchObject({ lines: 1 });
    expect(thoughtFont('Conhecer ela? Nunca imaginei.').fontSize).toBeGreaterThanOrEqual(58);
    const long = thoughtFont('Um cliente de fora do país me chamando para uma reunião? Um dia, quem sabe.');
    expect(long.fontSize).toBe(50);
    expect(long.lines).toBeLessThanOrEqual(3);
    // eyebrow + gap + as linhas dentro do balão de 320 px
    expect(41 + 26 + long.lines * long.fontSize * 1.12).toBeLessThan(320);
    expect(lineFont('Foi incrível pra mim.', USABLE_WIDTH, 88)).toBe(88);
    const closing = 'E no fim da conversa a gente fechou o projeto inteiro, com prazo e tudo.';
    expect(lineFont(closing, USABLE_WIDTH, 88)).toBeLessThan(88);
    expect(lineFont(closing, USABLE_WIDTH, 88)).toBeGreaterThanOrEqual(52);
  });
});

describe('EtiquetaRiscadaETrocada', () => {
  it('tempos: os padrões são os da cena de origem e o que falta segue em sequência', () => {
    const defaults = swapTimes();
    expect(defaults.icon).toBe(0.4);
    expect(defaults.card).toBeCloseTo(2.6);
    expect(defaults.strike).toBeCloseTo(3.6);
    expect(defaults.swap).toBeCloseTo(4.8);
    expect(swapTimes({ icon: 1, strike: 5 })).toEqual({ icon: 1, card: 3.2, strike: 5, swap: 6.2 });
  });

  it.each([
    ['cena de origem', 'Patrocinado', '100% sincero — minha experiência'],
    ['outro assunto', 'Texto puro', 'Hash com sal — irreversível'],
    ['etiquetas curtas', 'v1', 'v2'],
    ['etiquetas longas', 'Funciona na minha máquina', 'Roda igual em qualquer ambiente'],
  ])('%s: as duas etiquetas e a seta cabem no cartão', (_name, wrong, right) => {
    const layout = swapLayout(wrong, right);
    expect(layout.fits).toBe(true);
    expect(layout.fontSize).toBeGreaterThanOrEqual(34);
    expect(layout.wrongX).toBeGreaterThanOrEqual(0);
    expect(layout.rightX + layout.rightWidth).toBeLessThanOrEqual(layout.width + 0.5);
    expect(layout.soloX).toBeGreaterThanOrEqual(0);
    expect(layout.arrow.from[0]).toBeGreaterThan(layout.wrongX + layout.wrongWidth);
    expect(layout.arrow.to[0]).toBeLessThan(layout.rightX);
    expect(layout.arrow.to[0] - layout.arrow.from[0]).toBeGreaterThanOrEqual(60);
    // o conjunto fica centralizado
    expect(layout.wrongX).toBeCloseTo(layout.width - (layout.rightX + layout.rightWidth));
    expect(layout.height).toBe(pillHeight(layout.fontSize));
  });

  it('etiquetas longas encolhem a fonte; longas demais são sinalizadas', () => {
    expect(swapLayout('Patrocinado', '100% sincero — minha experiência').fontSize).toBe(40);
    expect(swapLayout('Funciona só na minha máquina mesmo', 'Roda igual em qualquer ambiente').fontSize).toBeLessThan(40);
    expect(swapLayout('Uma etiqueta errada comprida demais para o cartão', 'E a etiqueta certa também não ajuda em nada aqui').fits).toBe(false);
  });

  it('a pilha (ícone, título e cartão) cabe na área útil com os dois conjuntos', () => {
    const sets = [
      { title: 'Feito de coração.', hasEyebrow: true, hasCardEyebrow: true, note: 'Não fui patrocinado em nada pela empresa.' },
      { title: 'Guardada do jeito certo.', hasEyebrow: true, hasCardEyebrow: true, note: 'Nem quem administra o banco consegue ler.' },
      { title: 'O nome mudou no meio do caminho, mas a ideia continua exatamente a mesma.', hasEyebrow: true, hasCardEyebrow: true, note: 'Uma nota mais comprida, que explica a troca com calma e ainda sobra espaço para respirar no cartão.' },
    ];
    for (const set of sets) {
      const stack = swapStackHeight({ ...set, pill: pillHeight(40) });
      expect(stack.total, set.title).toBeLessThanOrEqual(USABLE_HEIGHT);
      expect(stack.card).toBeLessThan(stack.total);
    }
    expect(swapTitleFont('Feito de coração.')).toEqual({ fontSize: 104, lines: 1 });
    const long = swapTitleFont(sets[2]!.title);
    expect(long.fontSize).toBe(64);
    expect(long.lines).toBe(2);
  });

  it('risco e batida do ícone', () => {
    const strike = strikeLine(400, 72);
    expect(strike.from[0]).toBeLessThan(0);
    expect(strike.to[0]).toBeGreaterThan(400);
    expect(strike.to[1]).toBeLessThan(strike.from[1]);
    expect(strike.length).toBeGreaterThan(400);
    expect(pulse(0, 1)).toBe(1);
    expect(pulse(1.16, 1)).toBeGreaterThan(1.05);
    expect(pulse(3, 1)).toBe(1);
  });
});

describe('LargoVersusFundo', () => {
  it('quantidade: de 3 a 6 blocos de cada lado, padrão 6', () => {
    expect(digCount(undefined)).toBe(DIG_RANGE.default);
    expect(digCount(1)).toBe(DIG_RANGE.min);
    expect(digCount(40)).toBe(DIG_RANGE.max);
    expect(digCount(4.9)).toBe(4);
  });

  it('tempos: com 6 blocos os padrões são os da cena de origem; os rótulos seguem a escavação', () => {
    expect(digTimes(6)).toEqual({ wide: 1.3, deep: 3.3, deepLabel: 4.4, wideLabel: 5.5 });
    expect(digTimes(6, { wide: 1.3, deep: 3.3, deepLabel: 4.4, wideLabel: 5.5 })).toEqual({ wide: 1.3, deep: 3.3, deepLabel: 4.4, wideLabel: 5.5 });
    expect(digTimes(3).deepLabel).toBeLessThan(digTimes(6).deepLabel);
    expect(digTimes(4, { deep: 8 }).deepLabel).toBeGreaterThan(8);
  });

  it.each([3, 4, 5, 6])('com %i blocos: o mesmo número dos dois lados, a vala não encosta no poço e a gema fica dentro do paredão', (count) => {
    const plan = digPlan(count, { wide: 1.3, deep: 3.3 }, 30);
    const wide = plan.filter((step) => step.kind === 'wide');
    const deep = plan.filter((step) => step.kind === 'deep');
    expect(wide).toHaveLength(count);
    expect(deep).toHaveLength(count);
    expect(wide.every((step) => step.y === 0)).toBe(true);
    expect(deep.every((step) => step.x === DEEP_X)).toBe(true);
    expect(Math.max(...wide.map((step) => step.x))).toBeLessThan(DEEP_X - 1);
    expect(Math.min(...wide.map((step) => step.x))).toBe(WIDE_FROM_X);
    expect(Math.min(...deep.map((step) => step.y))).toBe(-(count - 1));
    const ore = orePosition(count);
    expect(ore).toEqual({ x: DEEP_X, y: -count });
    expect(ore.y).toBeGreaterThan(-WALL.rows);
    expect(plan.map((step) => step.frame)).toEqual([...plan.map((step) => step.frame)].sort((a, b) => a - b));

    const found = oreFrame(plan);
    expect(found).toBe(Math.max(...deep.map((step) => step.frame)) + BREAK_FRAMES);
    const before = worldBlocks(0, plan, '#4BE4FF');
    const after = worldBlocks(found + 1, plan, '#4BE4FF');
    expect(before.filter((block) => block.type === 'cavity')).toHaveLength(0);
    expect(after.filter((block) => block.type === 'cavity')).toHaveLength(count * 2);
    expect(before.length - after.length).toBe(count * 2);
    expect(before.find((block) => block.x === ore.x && block.y === ore.y && block.z === 0)?.type).toBe('ore:#4BE4FF');
    expect(after.find((block) => block.x === ore.x && block.y === ore.y && block.z === 0)?.type).toBe('ore-lit:#4BE4FF');
    expect(dugCount(found + 1, plan, 'wide')).toBe(count);
    expect(dugCount(0, plan, 'deep')).toBe(0);
  });

  it.each([
    ['cena de origem', 6, { label: 'Largura', hint: 'um pouco de tudo' }, { label: 'Profundidade', hint: 'tudo de uma coisa' }],
    ['outro assunto, menos blocos', 5, { label: 'Dez canais', hint: 'um post em cada' }, { label: 'Um canal', hint: 'todo dia, um ano' }],
    ['mínimo de blocos, sem apoio', 3, { label: 'Generalista', hint: undefined }, { label: 'Especialista', hint: undefined }],
  ])('%s: os dois rótulos ficam na tela e não se encostam', (_name, count, wide, deep) => {
    const anchors = labelAnchors(count);
    const poses = [orbitPose({ target: [0, -3, 0], distance: 28.5, azimuth: 10, elevation: 15 }), orbitPose({ target: [0.6, -3.1, 0], distance: 26.5, azimuth: 6, elevation: 13 })];
    for (const pose of poses) {
      const left = projectToScreen(pose, anchors.wide, 1920, 1080);
      const right = projectToScreen(pose, anchors.deep, 1920, 1080);
      const leftWidth = tooltipWidth(wide.label, wide.hint);
      const rightWidth = tooltipWidth(deep.label, deep.hint);
      expect(left.x - leftWidth / 2).toBeGreaterThanOrEqual(theme.safe.x);
      expect(right.x + rightWidth / 2).toBeLessThanOrEqual(1920 - theme.safe.x);
      expect(right.x - left.x).toBeGreaterThanOrEqual((leftWidth + rightWidth) / 2);
      // o rótulo fica acima do paredão, longe da faixa das legendas
      expect(left.y).toBeLessThan(1080 - CAPTION_ZONE - 200);
      expect(left.y).toBeGreaterThan(200);
    }
  });
});
