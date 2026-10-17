import { describe, expect, it } from 'vitest';

import {
  calloutGeometry,
  defaultSide,
  estimateLabelWidth,
  labelCenter,
  loopPoints,
  smoothPath,
} from '../motion/src/components/Callout.tsx';
import {
  appearBudget,
  fitFontSize,
  lineProgress,
  MAX_LINES,
  prepareCode,
  revealStep,
  sliceTokens,
  tokenize,
  tokenizeLines,
  typedAt,
  typedUnits,
  typingSeconds,
} from '../motion/src/components/CodeCard.tsx';
import {
  balanceLines,
  edgeGeometry,
  edgePath,
  edgeStart,
  EDGE_SEC,
  fitLabel,
  fitNodeLabel,
  layoutNodes,
  revealTimes,
} from '../motion/src/components/Diagram.tsx';
import { discState, fitTitle, introLayout } from '../motion/src/components/Intro.tsx';
import { memeRotation, normalizeAssetPath } from '../motion/src/components/MemeInsert.tsx';
import { outroLayout } from '../motion/src/components/Outro.tsx';

const SAFE = { x: 96, y: 64 };

describe('CodeCard: tokenize', () => {
  const types = (code: string, language?: Parameters<typeof tokenize>[1]) =>
    tokenize(code, language)
      .filter((token) => token.type !== 'plain')
      .map((token) => `${token.type}:${token.text}`);

  it('classifica keyword, função, número, string, pontuação e comentário em TS', () => {
    expect(types("const total = sum(41, 'a'); // soma")).toEqual([
      'keyword:const',
      'identifier:total',
      'punctuation:=',
      'function:sum',
      'punctuation:(',
      'number:41',
      'punctuation:,',
      "string:'a'",
      'punctuation:);',
      'comment:// soma',
    ]);
  });

  it('devolve exatamente o texto de entrada ao concatenar', () => {
    const code = 'if (a >= 0x1F) {\n\treturn `olá ${nome}`; /* fim\n de bloco */\n}';
    for (const language of ['ts', 'json', 'bash', 'java', 'python', 'sql'] as const) {
      expect(tokenize(code, language).map((token) => token.text).join('')).toBe(code);
    }
  });

  it('não confunde keyword dentro de string ou comentário', () => {
    expect(types('"return" // const')).toEqual(['string:"return"', 'comment:// const']);
  });

  it('trata chaves de JSON como identificador e valores como string', () => {
    expect(types('{ "name": "mce", "ok": true, "n": 2 }', 'json')).toEqual([
      'punctuation:{',
      'identifier:"name"',
      'punctuation::',
      'string:"mce"',
      'punctuation:,',
      'identifier:"ok"',
      'punctuation::',
      'keyword:true',
      'punctuation:,',
      'identifier:"n"',
      'punctuation::',
      'number:2',
      'punctuation:}',
    ]);
  });

  it('reconhece keywords de SQL sem diferenciar maiúsculas e o comentário com --', () => {
    expect(types('select nome FROM t -- nota', 'sql')).toEqual([
      'keyword:select',
      'identifier:nome',
      'keyword:FROM',
      'identifier:t',
      'comment:-- nota',
    ]);
  });

  it('em bash e python, # só abre comentário depois de espaço ou no começo da linha', () => {
    expect(types('echo $# # conta', 'bash')).toEqual(['keyword:echo', 'identifier:$', 'punctuation:#', 'comment:# conta']);
    expect(types('# topo\ndef f(x): return x', 'python').slice(0, 3)).toEqual(['comment:# topo', 'keyword:def', 'function:f']);
  });

  it('aceita identificadores acentuados e string sem fechamento', () => {
    expect(types("ação = 'abc")).toEqual(['identifier:ação', 'punctuation:=', "string:'abc"]);
  });
});

describe('CodeCard: linhas e digitação', () => {
  it('normaliza o código: tabs, CRLF, linhas vazias nas pontas e limite de linhas', () => {
    expect(prepareCode('\r\n\tif (x) {  \r\n\t\ty();\r\n\t}\r\n\r\n')).toEqual(['  if (x) {', '    y();', '  }']);
    const long = Array.from({ length: 20 }, (_, index) => `l${index}`).join('\n');
    expect(prepareCode(long)).toHaveLength(MAX_LINES);
  });

  it('separa tokens por linha mantendo comentário de bloco em todas as linhas', () => {
    const lines = ['a /* um', 'dois */ b'];
    const tokens = tokenizeLines(lines, 'ts');
    expect(tokens).toHaveLength(2);
    expect(tokens.map((line) => line.map((token) => token.text).join(''))).toEqual(lines);
    expect(tokens[1]![0]).toEqual({ type: 'comment', text: 'dois */' });
  });

  it('corta uma linha tokenizada no número de caracteres visíveis', () => {
    const [line] = tokenizeLines(['const x = 1;'], 'ts');
    expect(sliceTokens(line!, 0)).toEqual([]);
    expect(sliceTokens(line!, 3).map((token) => token.text).join('')).toBe('con');
    expect(sliceTokens(line!, 3)[0]!.type).toBe('keyword');
    expect(sliceTokens(line!, 99).map((token) => token.text).join('')).toBe('const x = 1;');
  });

  it('reduz a fonte até a linha mais longa caber, sem passar dos limites', () => {
    expect(fitFontSize(40, 1640)).toBe(34);
    expect(fitFontSize(100, 1640)).toBe(27);
    expect(100 * 27 * 0.6).toBeLessThanOrEqual(1640);
    expect(fitFontSize(400, 1640)).toBe(18);
    expect(fitFontSize(0, 1640)).toBe(34);
  });

  it('conta toques sem a indentação e com uma quebra por linha', () => {
    expect(typedUnits(['ab', '  cd', '', 'e'])).toBe(2 + 2 + 0 + 1 + 3);
    expect(typedUnits([])).toBe(0);
  });

  it('distribui os toques pelas linhas e posiciona o cursor', () => {
    const lines = ['ab', '  cd', 'e'];
    expect(lineProgress(lines, 0)).toEqual({ visible: [0, 0, 0], cursorLine: 0 });
    expect(lineProgress(lines, 2)).toEqual({ visible: [2, 0, 0], cursorLine: 0 });
    // o Enter leva o cursor para a linha seguinte já indentada
    expect(lineProgress(lines, 3)).toEqual({ visible: [2, 2, 0], cursorLine: 1 });
    expect(lineProgress(lines, 5)).toEqual({ visible: [2, 4, 0], cursorLine: 1 });
    expect(lineProgress(lines, typedUnits(lines))).toEqual({ visible: [2, 4, 1], cursorLine: 2 });
    expect(lineProgress(lines, 999)).toEqual({ visible: [2, 4, 1], cursorLine: 2 });
  });

  it('digita em ritmo natural e acelera só quando o bloco não cabe no tempo', () => {
    expect(typingSeconds(34, 10)).toBeCloseTo(1);
    expect(typingSeconds(3400, 10)).toBeCloseTo(appearBudget(10));
    expect(appearBudget(10)).toBeCloseTo(5.65);
    expect(appearBudget(0.2)).toBe(0.4);
  });

  it('avança os toques linearmente entre o início e o fim da digitação', () => {
    expect(typedAt(0, 30, 100, 2)).toBe(0);
    expect(typedAt(0.35 * 30, 30, 100, 2)).toBe(0);
    expect(typedAt((0.35 + 1) * 30, 30, 100, 2)).toBe(50);
    expect(typedAt(300, 30, 100, 2)).toBe(100);
    expect(typedAt(300, 30, 100, 0)).toBe(100);
  });

  it('encurta o intervalo do modo reveal quando há muitas linhas para pouco tempo', () => {
    expect(revealStep(6, 9)).toBe(0.16);
    expect(revealStep(12, 2)).toBeCloseTo(appearBudget(2) / 12);
  });
});

describe('Diagram', () => {
  const inside = (boxes: ReturnType<typeof layoutNodes>) =>
    boxes.every(
      (box) =>
        box.x >= SAFE.x - 0.01 && box.x + box.width <= 1920 - SAFE.x + 0.01 && box.y >= SAFE.y - 0.01 && box.y + box.height <= 1080 - SAFE.y + 0.01,
    );

  it('dispõe os nós em linha, centralizados e dentro da margem segura', () => {
    for (const direction of ['horizontal', 'vertical'] as const) {
      for (let count = 1; count <= 5; count++) {
        const boxes = layoutNodes(count, direction, { hasSublabel: true, hasEdgeLabel: true });
        expect(boxes).toHaveLength(count);
        expect(inside(boxes)).toBe(true);
        const first = boxes[0]!;
        const last = boxes.at(-1)!;
        if (direction === 'horizontal') expect(first.x + last.x + last.width).toBeCloseTo(1920);
        else expect(first.y + last.y + last.height).toBeCloseTo(1080);
      }
    }
  });

  it('limita a 5 nós e não sobrepõe caixas', () => {
    const boxes = layoutNodes(9, 'horizontal');
    expect(boxes).toHaveLength(5);
    boxes.slice(1).forEach((box, index) => expect(box.x).toBeGreaterThan(boxes[index]!.x + boxes[index]!.width));
    expect(layoutNodes(0)).toEqual([]);
  });

  it('liga vizinhos com reta que sai de uma caixa e chega na outra', () => {
    const boxes = layoutNodes(3, 'horizontal');
    const edge = edgeGeometry(boxes, 0, 1, 'horizontal')!;
    expect(edge.control).toBeUndefined();
    expect(edge.start.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.width);
    expect(edge.tip.x).toBeLessThan(boxes[1]!.x);
    expect(edge.end.x).toBeLessThan(edge.tip.x);
    expect(edge.start.y).toBe(edge.tip.y);
    expect(edge.angle).toBeCloseTo(0);
    expect(edgePath(edge)).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);

    const back = edgeGeometry(boxes, 1, 0, 'horizontal')!;
    expect(Math.abs(back.angle)).toBeCloseTo(180);
    expect(back.tip.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.width);
  });

  it('separa ida e volta entre o mesmo par de nós', () => {
    const boxes = layoutNodes(2, 'horizontal');
    const go = edgeGeometry(boxes, 0, 1, 'horizontal', true)!;
    const back = edgeGeometry(boxes, 1, 0, 'horizontal', true)!;
    expect(go.start.y).toBeLessThan(back.start.y);
    expect(go.label.y).toBeLessThan(go.start.y);
    expect(back.label.y).toBeGreaterThan(back.start.y);
  });

  it('contorna a fila com um arco quando os nós não são vizinhos', () => {
    const boxes = layoutNodes(4, 'horizontal');
    const over = edgeGeometry(boxes, 0, 2, 'horizontal')!;
    expect(over.control!.y).toBeLessThan(boxes[0]!.y);
    expect(over.label.y).toBeLessThan(boxes[0]!.y);
    expect(edgePath(over)).toContain(' Q ');
    const under = edgeGeometry(boxes, 3, 0, 'horizontal')!;
    expect(under.control!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height);
    // mesmo o arco mais longo fica dentro da tela
    expect(under.control!.y / 2 + under.start.y / 2).toBeLessThan(1080 - SAFE.y);
  });

  it('na vertical a seta desce e o arco sai pela lateral', () => {
    const boxes = layoutNodes(3, 'vertical');
    const down = edgeGeometry(boxes, 0, 1, 'vertical')!;
    expect(down.angle).toBeCloseTo(90);
    expect(down.start.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height);
    const side = edgeGeometry(boxes, 0, 2, 'vertical')!;
    expect(side.control!.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.width);
  });

  it('ignora laço e índice inexistente', () => {
    const boxes = layoutNodes(2);
    expect(edgeGeometry(boxes, 0, 0)).toBeNull();
    expect(edgeGeometry(boxes, 0, 7)).toBeNull();
  });

  it('calcula a entrada de cada nó, respeitando revealAt e a duração', () => {
    expect(revealTimes(3, 8)).toEqual([0, 0.9, 1.8]);
    expect(revealTimes(5, 2)).toEqual([0, 0.35, 0.7, 1.05, 1.4]);
    expect(revealTimes(3, 8, [0.5, 3])).toEqual([0.5, 3, 1.8]);
    expect(revealTimes(2, 4, [1, 99])).toEqual([1, 3.4]);
    expect(revealTimes(2, 4, [Number.NaN, -1])).toEqual([0, 0.9]);
  });

  it('desenha a seta entre os dois nós, chegando junto com o segundo', () => {
    expect(edgeStart(0, 0.9)).toBeCloseTo(0.9 - EDGE_SEC);
    expect(edgeStart(0.9, 0)).toBeCloseTo(0.9 - EDGE_SEC);
    // nós quase simultâneos: a seta espera o primeiro assentar
    expect(edgeStart(1, 1.1)).toBeCloseTo(1.15);
  });

  it('ajusta rótulos: uma linha quando cabe, duas equilibradas quando não', () => {
    expect(fitLabel('API', 300, 40, 20)).toBe(40);
    expect(fitLabel('x'.repeat(100), 300, 40, 20)).toBe(20);
    expect(balanceLines('Requisição do usuário')).toEqual(['Requisição', 'do usuário']);
    expect(balanceLines('Banco de dados')).toEqual(['Banco', 'de dados']);
    expect(balanceLines('Kubernetes')).toEqual(['Kubernetes']);
    expect(fitNodeLabel('API', 200, 40, 20)).toEqual({ lines: ['API'], fontSize: 40 });
    const wrapped = fitNodeLabel('Requisição do usuário', 217, 40, 20);
    expect(wrapped.lines).toHaveLength(2);
    expect(wrapped.fontSize).toBeGreaterThan(fitLabel('Requisição do usuário', 217, 40, 20));
    expect(wrapped.fontSize).toBeLessThanOrEqual(32);
  });
});

describe('Callout', () => {
  it('escolhe o lado do rótulo com mais espaço quando não informado', () => {
    expect(defaultSide(0.1)).toBe('bottom');
    expect(defaultSide(0.6)).toBe('top');
    expect(calloutGeometry({ shape: 'box', x: 0.5, y: 0.1 }).side).toBe('bottom');
    expect(calloutGeometry({ shape: 'box', x: 0.5, y: 0.1, labelSide: 'left' }).side).toBe('left');
  });

  it('converte a região normalizada em pixels, centrada em x/y', () => {
    const { bounds, strokes } = calloutGeometry({ shape: 'box', x: 0.5, y: 0.5, width: 0.25, height: 0.2 });
    expect(bounds).toEqual({ left: 720, top: 432, right: 1200, bottom: 648 });
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.d.startsWith('M ')).toBe(true);
    expect(strokes[0]!.d).not.toContain('NaN');
  });

  it('desenha o círculo redondo em pixels quando só a largura é informada', () => {
    const { bounds } = calloutGeometry({ shape: 'circle', x: 0.5, y: 0.5, width: 0.2 });
    expect(bounds.right - bounds.left).toBeCloseTo(bounds.bottom - bounds.top);
  });

  it('o laço do círculo dá mais de uma volta e termina por fora do começo', () => {
    const center = { x: 500, y: 500 };
    const points = loopPoints(center, 100, 100, 40);
    expect(points).toHaveLength(41);
    const radius = (point: { x: number; y: number }) => Math.hypot(point.x - center.x, point.y - center.y);
    expect(radius(points.at(-1)!)).toBeGreaterThan(radius(points[0]!) + 10);
    const path = smoothPath(points);
    expect(path.match(/C/g)).toHaveLength(40);
    expect(smoothPath([])).toBe('');
  });

  it('a seta termina no ponto indicado e a cauda fica no lado do rótulo', () => {
    const geometry = calloutGeometry({ shape: 'arrow', x: 0.5, y: 0.5, width: 0.1, labelSide: 'left' });
    expect(geometry.strokes).toHaveLength(2);
    const [shaft, head] = geometry.strokes;
    expect(shaft!.to).toBe(head!.from);
    expect(head!.to).toBe(1);
    const numbers = shaft!.d.match(/-?[\d.]+/g)!.map(Number);
    const tip = { x: numbers.at(-2)!, y: numbers.at(-1)! };
    expect(Math.hypot(tip.x - 960, tip.y - 540)).toBeLessThan(20);
    expect(geometry.bounds.left).toBeLessThan(960 - 150);
    expect(geometry.bounds.left).toBe(geometry.bounds.right);
  });

  it('o sublinhado atravessa a largura pedida', () => {
    const { bounds } = calloutGeometry({ shape: 'underline', x: 0.5, y: 0.8, width: 0.5 });
    expect(bounds.left).toBe(480);
    expect(bounds.right).toBe(1440);
  });

  it('prende coordenadas fora de 0–1', () => {
    const { bounds } = calloutGeometry({ shape: 'underline', x: 4, y: -2, width: 0.1 });
    expect((bounds.left + bounds.right) / 2).toBe(1920);
    expect((bounds.top + bounds.bottom) / 2).toBe(0);
  });

  it('posiciona o rótulo no lado pedido e dentro da margem segura', () => {
    const bounds = { left: 800, top: 400, right: 1000, bottom: 600 };
    const size = { width: 300, height: 64 };
    expect(labelCenter(bounds, 'top', size)).toEqual({ x: 900, y: 400 - 22 - 32 });
    expect(labelCenter(bounds, 'right', size)).toEqual({ x: 1000 + 22 + 150, y: 500 });
    const corner = labelCenter({ left: 1800, top: 10, right: 1900, bottom: 60 }, 'top', size);
    expect(corner).toEqual({ x: 1920 - SAFE.x - 150, y: SAFE.y + 32 });
  });

  it('estima a largura da pílula com teto', () => {
    expect(estimateLabelWidth('abc')).toBeLessThan(estimateLabelWidth('abcdef'));
    expect(estimateLabelWidth('x'.repeat(300))).toBe(760);
  });
});

describe('MemeInsert', () => {
  it('normaliza o caminho para relativo à pasta assets', () => {
    expect(normalizeAssetPath('memes/a.png')).toBe('memes/a.png');
    expect(normalizeAssetPath('assets/memes/a.png')).toBe('memes/a.png');
    expect(normalizeAssetPath('./assets\\memes\\a b.png')).toBe('memes/a b.png');
    expect(normalizeAssetPath('/memes/a.png')).toBe('memes/a.png');
    expect(normalizeAssetPath('https://exemplo.dev/a.png')).toBe('https://exemplo.dev/a.png');
  });

  it('assenta levemente inclinado', () => {
    expect(memeRotation(1, 'corner')).toBe(3);
    expect(memeRotation(1, 'full')).toBe(-1.5);
    expect(Math.abs(memeRotation(0, 'corner'))).toBeGreaterThan(3);
  });
});

describe('Intro e Outro', () => {
  it('ajusta o título à largura disponível', () => {
    expect(fitTitle('MChiodi', 1728, 168, 72)).toBe(168);
    expect(fitTitle('Um título de vinheta bem mais comprido', 1728, 168, 72)).toBe(81);
    expect(fitTitle('x'.repeat(200), 1728, 168, 72)).toBe(72);
  });

  it('o disco nasce no centro da tela e assenta no topo do bloco', () => {
    const { discOffset, blockHeight } = introLayout(168, true);
    expect(discOffset).toBe(blockHeight / 2 - 56);
    expect(discState(0, 30, discOffset)).toEqual({ scale: 0, y: discOffset });
    const grown = discState(15, 30, discOffset);
    expect(grown.scale).toBeCloseTo(2.2);
    expect(grown.y).toBe(discOffset);
    expect(discState(74, 30, discOffset)).toEqual({ scale: 1, y: 0 });
    expect(introLayout(168, false).blockHeight).toBeLessThan(blockHeight);
  });

  it('reserva dois espaços 16:9 simétricos e dentro da margem segura', () => {
    const { slots, labelTop, handleTop, titleTop } = outroLayout();
    const [left, right] = slots;
    for (const slot of slots) expect(slot.width / slot.height).toBeCloseTo(16 / 9);
    expect(left.x).toBeGreaterThanOrEqual(SAFE.x);
    expect(left.x + right.x + right.width).toBe(1920);
    expect(right.x).toBeGreaterThan(left.x + left.width);
    expect(titleTop).toBeGreaterThanOrEqual(SAFE.y);
    expect(labelTop).toBeGreaterThan(left.y + left.height);
    expect(handleTop).toBeGreaterThan(labelTop);
    expect(handleTop).toBeLessThan(1080 - SAFE.y);
  });

  it('escala os espaços com a resolução', () => {
    const { slots } = outroLayout({ width: 1280, height: 720 });
    expect(slots[0].width / slots[0].height).toBeCloseTo(16 / 9, 1);
    expect(slots[0].x + slots[1].x + slots[1].width).toBeCloseTo(1280, 0);
  });
});
