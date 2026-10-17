import { describe, expect, it } from 'vitest';

import type { ComponentEntry } from '../motion/src/components/registry.ts';
import { arrowGeometry } from '../motion/src/scene-kit/Arrow.tsx';
import { ICON_NAMES, ICONS, isIconName } from '../motion/src/scene-kit/icons.tsx';
import { splitFlex } from '../motion/src/scene-kit/Split.tsx';
import { statementTimes } from '../motion/src/scene-kit/Statement.tsx';
import { at, enter, popIn, rise, window } from '../motion/src/scene-kit/timing.ts';
import { alpha, CAPTION_ZONE, text, toneColors } from '../motion/src/scene-kit/tokens.ts';
import { bitmapToBlocks, buildBox, buildIsland, buildTerrain, linePath, ringRelief } from '../motion/src/scene-kit/voxel/builders.ts';
import { horizonY, mixPose, orbitPose, projectToScreen } from '../motion/src/scene-kit/voxel/camera.ts';
import { pop, progress, pulse, swing } from '../motion/src/scene-kit/voxel/math.ts';
import { burstBlocks, risingBlocks } from '../motion/src/scene-kit/voxel/particle-math.ts';
import { hash3, hashString, mulberry32 } from '../motion/src/scene-kit/voxel/random.ts';
import { snap, splitAccent, typeSegments } from '../motion/src/scene-kit/voxel/ui/layout.ts';
import { PIXEL_ICONS, pixelColor } from '../motion/src/scene-kit/voxel/ui/PixelIcon.tsx';
import { markWords, wordDelay, wordsEnd } from '../motion/src/scene-kit/Words.tsx';
import { sceneRegistry } from '../motion/src/scenes/index.ts';
import { BREAK_FRAMES, DEEP, digPlan, dugCount, layerType, ORE, oreFrame, WALL, WIDE, worldBlocks } from '../motion/src/scenes/teste-fullstack/depth-logic.ts';
import { exchangeLayout } from '../motion/src/scenes/teste-fullstack/EnviarReceber.tsx';
import { fullStackLayout } from '../motion/src/scenes/teste-fullstack/FullStack.tsx';
import { theme } from '../motion/src/theme.ts';

const FPS = 30;

describe('scene-kit: timing', () => {
  it('at converte segundos em frame inteiro', () => {
    expect(at(0, FPS)).toBe(0);
    expect(at(1.5, FPS)).toBe(45);
    expect(at(0.99, 60)).toBe(59);
  });

  it('enter fica em 0 antes do atraso, em 1 depois da duração e desacelera no meio', () => {
    expect(enter(0, FPS, 1, 0.5)).toBe(0);
    expect(enter(30, FPS, 1, 0.5)).toBe(0);
    expect(enter(45, FPS, 1, 0.5)).toBe(1);
    expect(enter(300, FPS, 1, 0.5)).toBe(1);
    // curva de entrada: na metade do tempo já passou bem da metade do caminho
    expect(enter(37.5, FPS, 1, 0.5)).toBeGreaterThan(0.8);
  });

  it('rise some e desce no início, e pousa no lugar', () => {
    expect(rise(0, 40)).toEqual({ opacity: 0, translate: '0px 40.00px' });
    expect(rise(1, 40)).toEqual({ opacity: 1, translate: '0px 0.00px' });
    expect(rise(0.5).translate).toBe('0px 14.00px');
  });

  it('window vale 1 só dentro da janela', () => {
    expect(window(0, 1, 3, FPS)).toBe(0);
    expect(window(60, 1, 3, FPS)).toBe(1);
    expect(window(90, 1, 3, FPS)).toBe(0);
    expect(window(200, 1, 3, FPS)).toBe(0);
    const edge = window(33, 1, 3, FPS);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });

  it('window aguenta janela mais curta que as duas bordas', () => {
    const values = [0, 30, 31, 32, 33, 34, 60].map((frame) => window(frame, 1, 1.1, FPS));
    expect(values.every((value) => value >= 0 && value <= 1 && Number.isFinite(value))).toBe(true);
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(0);
  });

  it('popIn passa de 1 no caminho e termina em 1', () => {
    expect(popIn(0, FPS, 0, 0.4)).toBe(0);
    expect(popIn(12, FPS, 0, 0.4)).toBe(1);
    expect(Math.max(...Array.from({ length: 12 }, (_, frame) => popIn(frame, FPS, 0, 0.4)))).toBeGreaterThan(1);
  });
});

describe('scene-kit: texto e tokens', () => {
  it('markWords marca só as palavras do trecho de acento', () => {
    expect(markWords('Uma pessoa, as duas pontas.', 'as duas pontas')).toEqual([
      { word: 'Uma', accent: false },
      { word: 'pessoa,', accent: false },
      { word: 'as', accent: true },
      { word: 'duas', accent: true },
      { word: 'pontas.', accent: true },
    ]);
    expect(markWords('sem acento').every((item) => !item.accent)).toBe(true);
    expect(markWords('o trecho não existe', 'outro').every((item) => !item.accent)).toBe(true);
    expect(markWords('   ')).toEqual([]);
  });

  it('wordDelay e wordsEnd escalonam as palavras', () => {
    expect(wordDelay(0, 1)).toBe(1);
    expect(wordDelay(4, 1, 0.05)).toBeCloseTo(1.2);
    expect(wordsEnd('um dois três', 0.5, 0.1)).toBeCloseTo(0.7);
    expect(wordsEnd('', 0.5)).toBe(0.5);
  });

  it('statementTimes põe eyebrow, título e apoio em ordem', () => {
    const plain = statementTimes('um dois três', 2);
    expect(plain.title).toBe(2);
    const withEyebrow = statementTimes('um dois três', 2, true);
    expect(withEyebrow.eyebrow).toBe(2);
    expect(withEyebrow.title).toBeGreaterThan(withEyebrow.eyebrow);
    expect(withEyebrow.support).toBeGreaterThan(withEyebrow.title);
  });

  it('alpha converte hex do tema em rgba', () => {
    expect(alpha('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    expect(alpha(theme.color.coral, 1)).toBe('rgba(255, 85, 85, 1)');
  });

  it('tons de cena invertem papel e tinta, e o texto do kit nunca fica abaixo de 34 px', () => {
    expect(toneColors('paper').background).toBe(theme.color.paper);
    expect(toneColors('night').background).toBe(theme.color.night);
    expect(toneColors('night').title).toBe(theme.color.white);
    expect(Math.min(...Object.values(text))).toBeGreaterThanOrEqual(34);
    expect(CAPTION_ZONE).toBe(180);
  });

  it('splitFlex limita a proporção', () => {
    expect(splitFlex(0.5)).toEqual({ left: 0.5, right: 0.5 });
    expect(splitFlex(2).left).toBe(0.9);
    expect(splitFlex(-1).left).toBe(0.1);
  });

  it('todo ícone tem ao menos um path e isIconName reconhece só os do kit', () => {
    expect(ICON_NAMES).toEqual(expect.arrayContaining(['server', 'database', 'browser', 'phone', 'code', 'gear', 'bolt', 'lock', 'user', 'cloud', 'check', 'x']));
    for (const name of ICON_NAMES) {
      expect(ICONS[name].length).toBeGreaterThan(0);
      expect(ICONS[name].every((d) => d.startsWith('M'))).toBe(true);
    }
    expect(isIconName('server')).toBe(true);
    expect(isIconName('toString')).toBe(false);
  });
});

describe('scene-kit: Arrow', () => {
  it('seta reta: comprimento é a distância e a ponta abre para trás', () => {
    const { d, length, head } = arrowGeometry([0, 0], [100, 0], 0, 10);
    expect(length).toBeCloseTo(100, 5);
    expect(d).toBe('M0 0 Q50 0 100 0');
    expect(head[1]).toEqual([100, 0]);
    expect(head[0][0]).toBeLessThan(100);
    expect(head[2][0]).toBeLessThan(100);
    // asas simétricas em volta do eixo da seta
    expect(head[0][1]).toBeCloseTo(-head[2][1], 5);
  });

  it('seta curva é mais longa e o meio passa no desvio pedido', () => {
    const straight = arrowGeometry([0, 0], [200, 0]);
    const curved = arrowGeometry([0, 0], [200, 0], -40);
    expect(curved.length).toBeGreaterThan(straight.length);
    // controle a 2x o desvio → ponto médio da quadrática em y = -40
    expect(curved.d).toBe('M0 0 Q100 -80 200 0');
  });

  it('não quebra com pontos coincidentes', () => {
    const { length, head } = arrowGeometry([5, 5], [5, 5]);
    expect(length).toBeCloseTo(0);
    expect(head.flat().every(Number.isFinite)).toBe(true);
  });
});

describe('scene-kit voxel: aleatoriedade e builders', () => {
  it('hash e gerador são determinísticos e ficam em [0, 1)', () => {
    expect(hashString('mchiodi')).toBe(hashString('mchiodi'));
    expect(hashString('a')).not.toBe(hashString('b'));
    const first = mulberry32(42);
    const second = mulberry32(42);
    const values = Array.from({ length: 50 }, () => first());
    expect(values).toEqual(Array.from({ length: 50 }, () => second()));
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(hash3('s', 1, 2, 3)).toBe(hash3('s', 1, 2, 3));
    expect(hash3('s', 1, 2, 3)).not.toBe(hash3('s', 3, 2, 1));
  });

  it('buildTerrain é determinístico, respeita o raio e deixa o centro plano', () => {
    const config = { radius: 20, seed: 'teste-terreno', maxHeight: 5, relief: ringRelief(8) };
    const terrain = buildTerrain(config);
    expect(terrain.length).toBeGreaterThan(0);
    expect(buildTerrain({ ...config })).toEqual(terrain);
    expect(terrain.every((block) => Math.hypot(block.x, block.z) <= 20 && Math.hypot(block.x, block.z) > 8)).toBe(true);
    expect(terrain.every((block) => block.y >= 1 && block.y <= 5)).toBe(true);
    // toda coluna termina em grama
    const tops = new Map<string, { y: number; type: string }>();
    for (const block of terrain) {
      const key = `${block.x}:${block.z}`;
      const top = tops.get(key);
      if (!top || block.y > top.y) tops.set(key, { y: block.y, type: block.type });
    }
    expect([...tops.values()].every((top) => top.type === 'grass')).toBe(true);
  });

  it('buildTerrain não devolve o cache de outra configuração com o mesmo seed', () => {
    const small = buildTerrain({ radius: 12, seed: 'mesmo-seed', maxHeight: 4, relief: () => 1 });
    const large = buildTerrain({ radius: 18, seed: 'mesmo-seed', maxHeight: 4, relief: () => 1 });
    expect(large.length).toBeGreaterThan(small.length);
  });

  it('ringRelief é 0 dentro do raio plano e 1 longe', () => {
    const relief = ringRelief(10);
    expect(relief(0, 0)).toBe(0);
    expect(relief(10, 0)).toBe(0);
    expect(relief(13, 0)).toBeCloseTo(0.5);
    expect(relief(40, 0)).toBe(1);
  });

  it('buildIsland: topo no tipo pedido, camadas afinando para baixo', () => {
    const island = buildIsland(10, -4, 3, 'grass');
    const layer = (dy: number) => island.filter((block) => block.y === dy);
    expect(layer(0).every((block) => block.type === 'grass')).toBe(true);
    expect(layer(-1).every((block) => block.type === 'dirt')).toBe(true);
    expect(layer(0).length).toBe(37);
    expect(layer(0).length).toBeGreaterThan(layer(-1).length);
    expect(layer(-1).length).toBeGreaterThan(layer(-2).length);
    expect(layer(-2).length).toBeGreaterThan(layer(-3).length);
    expect(island.every((block) => Math.hypot(block.x - 10, block.z + 4) <= 3.3)).toBe(true);
    expect(buildIsland(0, 0, 0, 'stone')).toEqual([{ x: 0, y: 0, z: 0, type: 'stone' }]);
  });

  it('linePath anda um passo por vez e liga os extremos', () => {
    const path = linePath([0, 0], [4, -2]);
    expect(path[0]).toEqual([0, 0]);
    expect(path.at(-1)).toEqual([4, -2]);
    expect(path).toHaveLength(7);
    for (let i = 1; i < path.length; i++) {
      const [x, z] = path[i]!;
      const [px, pz] = path[i - 1]!;
      expect(Math.abs(x - px) + Math.abs(z - pz)).toBe(1);
    }
    expect(linePath([2, 2], [2, 2])).toEqual([[2, 2]]);
  });

  it('buildBox conta as células e respeita os vazios', () => {
    expect(buildBox([0, 0, 0], [2, 1, 3], () => 'stone')).toHaveLength(3 * 2 * 4);
    const hollow = buildBox([0, 0, 0], [2, 2, 2], (x, y, z) => (x === 1 && y === 1 && z === 1 ? null : 'planks'));
    expect(hollow).toHaveLength(26);
  });

  it('bitmapToBlocks centra o desenho e ignora os vazios', () => {
    const blocks = bitmapToBlocks(['a.a', '.a.'], (char) => (char === 'a' ? '#ff5555' : null), 0.5);
    expect(blocks).toHaveLength(3);
    expect(blocks.every((block) => block.type === 'solid:#ff5555' && block.scale === 0.5 && block.z === 0)).toBe(true);
    expect(blocks.map((block) => [block.x, block.y])).toEqual([
      [-0.5, 0.25],
      [0.5, 0.25],
      [0, -0.25],
    ]);
  });
});

describe('scene-kit voxel: câmera', () => {
  const a = orbitPose({ target: [0, 0, 0], distance: 10, azimuth: 0, elevation: 0 });
  const b = orbitPose({ target: [4, 2, 0], distance: 20, azimuth: 90, elevation: 30, fov: 60 });

  it('orbitPose coloca a câmera na distância certa', () => {
    expect(a.position[0]).toBeCloseTo(0);
    expect(a.position[1]).toBeCloseTo(0);
    expect(a.position[2]).toBeCloseTo(10);
    expect(a.fov).toBe(40);
    expect(Math.hypot(b.position[0] - 4, b.position[1] - 2, b.position[2])).toBeCloseTo(20);
    expect(b.position[1]).toBeCloseTo(2 + 10);
  });

  it('mixPose devolve as poses nos extremos e a média no meio', () => {
    expect(mixPose(a, b, 0)).toEqual(a);
    expect(mixPose(a, b, 1)).toEqual(b);
    const mid = mixPose(a, b, 0.5);
    expect(mid.fov).toBe(50);
    expect(mid.target).toEqual([2, 1, 0]);
    expect(mid.position[2]).toBeCloseTo((a.position[2] + b.position[2]) / 2);
  });

  it('projectToScreen: o alvo cai no centro da tela', () => {
    for (const pose of [a, b]) {
      const center = projectToScreen(pose, pose.target, 1920, 1080);
      expect(center.x).toBeCloseTo(960, 3);
      expect(center.y).toBeCloseTo(540, 3);
    }
  });

  it('projectToScreen: para cima no mundo é para cima na tela, direita é direita', () => {
    const up = projectToScreen(a, [0, 1, 0], 1920, 1080);
    const right = projectToScreen(a, [1, 0, 0], 1920, 1080);
    expect(up.y).toBeLessThan(540);
    expect(up.x).toBeCloseTo(960, 3);
    expect(right.x).toBeGreaterThan(960);
  });

  it('horizonY sobe quando a câmera olha mais de cima', () => {
    const low = orbitPose({ target: [0, 0, 0], distance: 20, azimuth: 0, elevation: 5 });
    const high = orbitPose({ target: [0, 0, 0], distance: 20, azimuth: 0, elevation: 40 });
    expect(horizonY(high, 1920, 1080)).toBeLessThan(horizonY(low, 1920, 1080));
  });
});

describe('scene-kit voxel: tempo, partículas e UI', () => {
  it('progress, swing e pulse', () => {
    expect(progress(0, 10, 20)).toBe(0);
    expect(progress(20, 10, 20)).toBe(1);
    expect(swing(0, 20)).toBeCloseTo(0);
    expect(swing(10, 20)).toBeCloseTo(1);
    expect(swing(20, 20)).toBeCloseTo(0);
    expect(pulse(10, 10, 5)).toBe(1);
    expect(pulse(15, 10, 5)).toBe(0);
    expect(pulse(100, 10, 5)).toBe(0);
  });

  it('pop é 0 antes do início e assenta em 1', () => {
    expect(pop(4, 5, FPS)).toBe(0);
    expect(pop(5, 5, FPS)).toBe(0);
    expect(pop(90, 5, FPS)).toBeCloseTo(1, 2);
  });

  it('burstBlocks só existe durante a vida e é determinístico', () => {
    const options = { start: 10, seed: 'b', origin: [1, 2, 3] as [number, number, number], type: 'stone', count: 6, life: 20 };
    expect(burstBlocks(9, options)).toEqual([]);
    expect(burstBlocks(31, options)).toEqual([]);
    const born = burstBlocks(10, options);
    expect(born).toHaveLength(6);
    expect(born.every((block) => block.x === 1 && block.y === 2 && block.z === 3)).toBe(true);
    expect(burstBlocks(20, options)).toEqual(burstBlocks(20, options));
    expect(burstBlocks(30, options).every((block) => block.scale === 0)).toBe(true);
  });

  it('risingBlocks desliga com intensidade 0 e fica dentro da altura', () => {
    const options = { seed: 'r', center: [0, 0, 0] as [number, number, number], type: 'glow:#fff', count: 10, height: 8 };
    expect(risingBlocks(5, { ...options, intensity: 0 })).toEqual([]);
    const blocks = risingBlocks(123, options);
    expect(blocks).toHaveLength(10);
    expect(blocks.every((block) => block.y >= 0 && block.y < 8 && (block.scale ?? 0) >= 0)).toBe(true);
  });

  it('splitAccent, typeSegments e snap', () => {
    expect(splitAccent({ text: 'sei um pouco de tudo', accent: 'um pouco' })).toEqual([
      { text: 'sei ', accent: false },
      { text: 'um pouco', accent: true },
      { text: ' de tudo', accent: false },
    ]);
    expect(splitAccent({ text: 'sem acento' })).toEqual([{ text: 'sem acento', accent: false }]);
    const typed = typeSegments(splitAccent({ text: 'npm run dev', accent: 'run' }), 6);
    expect(typed.map((segment) => segment.text)).toEqual(['npm ', 'ru', '']);
    expect(typeSegments(splitAccent({ text: 'abc' }), -3)[0]?.text).toBe('');
    expect(snap(1.26)).toBe(1.5);
    expect(snap(1.2)).toBe(1);
  });

  it('ícones de pixel são quadrados e usam só letras conhecidas', () => {
    for (const rows of Object.values(PIXEL_ICONS)) {
      expect(rows).toHaveLength(12);
      for (const row of rows) {
        expect(row).toHaveLength(12);
        expect([...row].every((char) => char === '.' || pixelColor(char) !== null)).toBe(true);
      }
    }
    expect(pixelColor('.')).toBeNull();
    expect(pixelColor('z', { z: '#000000' })).toBe('#000000');
  });
});

describe('cenas de exemplo (teste-fullstack)', () => {
  const keys = ['teste-fullstack/EnviarReceber', 'teste-fullstack/FullStack', 'teste-fullstack/ProfundidadeVsLargura'];

  it('as três estão no índice gerado com entry válido', () => {
    for (const key of keys) {
      const entry: ComponentEntry | undefined = sceneRegistry[key];
      expect(entry, key).toBeDefined();
      expect(typeof entry!.component).toBe('function');
      expect(entry!.defaultDuration).toBeGreaterThanOrEqual(5);
      expect(entry!.defaultDuration).toBeLessThanOrEqual(8);
      expect(entry!.description.length).toBeGreaterThan(20);
      expect(entry!.sample).toHaveProperty('revealAt');
      // todo tempo de revelação cabe na duração sugerida
      const times = Object.values(entry!.sample.revealAt as Record<string, number>);
      expect(times.length).toBeGreaterThan(0);
      expect(times.every((time) => time >= 0 && time < entry!.defaultDuration)).toBe(true);
    }
  });

  it('FullStack: cartões nas pontas, pessoa no centro, setas sem invadir ninguém', () => {
    const layout = fullStackLayout(1728);
    expect(layout.frontX).toBe(0);
    expect(layout.backX + layout.card.width).toBe(1728);
    expect(layout.badge.center[0]).toBe(864);
    // seta da esquerda vai da pessoa até o cartão do front; a da direita, até o do back
    expect(layout.toFront.from[0]).toBeLessThan(layout.badge.center[0] - layout.badge.size / 2);
    expect(layout.toFront.to[0]).toBeGreaterThan(layout.card.width);
    expect(layout.toFront.to[0]).toBeLessThan(layout.toFront.from[0]);
    expect(layout.toBack.from[0]).toBeGreaterThan(layout.badge.center[0] + layout.badge.size / 2);
    expect(layout.toBack.to[0]).toBeLessThan(layout.backX);
    expect(layout.toBack.to[0]).toBeGreaterThan(layout.toBack.from[0]);
    // simetria em volta do centro
    expect(layout.toFront.to[0] + layout.toBack.to[0]).toBeCloseTo(1728);
  });

  it('EnviarReceber: ida por cima, volta por baixo, rótulos no meio das curvas', () => {
    const layout = exchangeLayout(1320);
    expect(layout.front[0]).toBeLessThan(layout.back[0]);
    expect(layout.send.from[0]).toBeLessThan(layout.send.to[0]);
    expect(layout.receive.from[0]).toBeGreaterThan(layout.receive.to[0]);
    expect(layout.send.label[1]).toBeLessThan(layout.receive.label[1]);
    for (const arrow of [layout.send, layout.receive]) {
      // o rótulo fica no ponto médio da curva (controle a 2x o desvio → meio a 1x)
      const geometry = arrowGeometry(arrow.from, arrow.to, arrow.bend);
      const control = /Q(\S+) (\S+) /.exec(geometry.d)!;
      const midY = 0.25 * arrow.from[1] + 0.5 * Number(control[2]) + 0.25 * arrow.to[1];
      expect(arrow.label[0]).toBeCloseTo(660);
      expect(arrow.label[1]).toBeCloseTo(midY);
      // as setas não encostam nos discos
      expect(Math.min(arrow.from[0], arrow.to[0])).toBeGreaterThan(layout.badge);
      expect(Math.max(arrow.from[0], arrow.to[0])).toBeLessThan(1320 - layout.badge);
    }
    expect(layout.height).toBeGreaterThan(layout.labelY);
  });

  describe('ProfundidadeVsLargura', () => {
    const plan = digPlan({ wide: 1, deep: 3 }, FPS);
    const total = (WALL.maxX - WALL.minX + 1) * WALL.rows * WALL.layers;
    const base = worldBlocks(0, plan, '#4BE4FF').length - total;

    it('largura e profundidade cavam o mesmo número de blocos', () => {
      const wide = plan.filter((step) => step.kind === 'wide');
      const deep = plan.filter((step) => step.kind === 'deep');
      expect(wide).toHaveLength(WIDE.count);
      expect(deep).toHaveLength(DEEP.count);
      expect(wide).toHaveLength(deep.length);
      expect(new Set(wide.map((step) => step.y))).toEqual(new Set([0]));
      expect(new Set(deep.map((step) => step.x))).toEqual(new Set([DEEP.x]));
      expect(deep.map((step) => step.y)).toEqual([0, -1, -2, -3, -4, -5]);
      expect(wide[0]!.frame).toBe(30);
      expect(deep[0]!.frame).toBe(90);
      // cada escavação anda em ordem
      for (const steps of [wide, deep]) {
        expect(steps.map((step) => step.frame)).toEqual([...steps.map((step) => step.frame)].sort((x, y) => x - y));
      }
    });

    it('o poço termina em cima do minério e a vala não cruza com ele', () => {
      expect(ORE).toEqual({ x: DEEP.x, y: -DEEP.count });
      expect(-ORE.y).toBeLessThan(WALL.rows);
      expect(WIDE.fromX + WIDE.count - 1).toBeLessThan(DEEP.x);
      expect(WIDE.fromX).toBeGreaterThan(WALL.minX);
    });

    it('camadas do solo de cima para baixo', () => {
      expect([0, -1, -2, -3, -4, -5, -6].map(layerType)).toEqual(['grass', 'dirt', 'dirt', 'stone', 'stone', 'deepstone', 'deepstone']);
    });

    it('antes de cavar o paredão está inteiro e o minério apagado', () => {
      const blocks = worldBlocks(0, plan, '#4BE4FF');
      expect(base).toBeGreaterThan(0);
      expect(blocks.filter((block) => block.type === 'cavity')).toHaveLength(0);
      expect(blocks.filter((block) => block.type === 'ore:#4BE4FF')).toHaveLength(1);
      expect(blocks.some((block) => block.type.startsWith('ore-lit'))).toBe(false);
      expect(dugCount(0, plan, 'wide')).toBe(0);
    });

    it('bloco quebrando encolhe e depois some, deixando o miolo escuro', () => {
      const first = plan[0]!;
      const breaking = worldBlocks(first.frame + 2, plan, '#4BE4FF').find((block) => block.x === first.x && block.y === first.y && block.z === 0);
      expect(breaking?.scale).toBeCloseTo(0.5);
      const after = worldBlocks(first.frame + BREAK_FRAMES, plan, '#4BE4FF');
      expect(after.find((block) => block.x === first.x && block.y === first.y && block.z === 0)).toBeUndefined();
      expect(after.find((block) => block.x === first.x && block.y === first.y && block.z === -1)?.type).toBe('cavity');
      expect(after).toHaveLength(total + base - 1);
    });

    it('no fim faltam exatamente os 12 blocos cavados e o minério acende', () => {
      const end = oreFrame(plan);
      expect(end).toBe(plan.at(-1)!.frame + BREAK_FRAMES);
      const before = worldBlocks(end - 1, plan, '#4BE4FF');
      expect(before.some((block) => block.type.startsWith('ore-lit'))).toBe(false);
      const blocks = worldBlocks(end, plan, '#4BE4FF');
      expect(blocks).toHaveLength(total + base - 12);
      expect(blocks.filter((block) => block.type === 'cavity')).toHaveLength(12);
      expect(blocks.filter((block) => block.type === 'ore-lit:#4BE4FF')).toEqual([{ x: ORE.x, y: ORE.y, z: 0, type: 'ore-lit:#4BE4FF' }]);
      expect(dugCount(end, plan, 'wide')).toBe(6);
      expect(dugCount(end, plan, 'deep')).toBe(6);
    });

    it('é função pura do frame', () => {
      expect(worldBlocks(77, plan, '#4BE4FF')).toEqual(worldBlocks(77, digPlan({ wide: 1, deep: 3 }, FPS), '#4BE4FF'));
    });
  });
});
