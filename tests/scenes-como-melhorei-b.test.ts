import { describe, expect, it } from 'vitest';

import { CAPTION_ZONE } from '../motion/src/scene-kit/tokens.ts';
import { dingStrength, entry as alfredEntry, servedCount, serveLayout, serveTimes, trayPath } from '../motion/src/scenes/como-melhorei/AlfredDio.tsx';
import {
  articleLayout,
  BODY_LINES,
  bodyLineTimes,
  entry as artigoEntry,
  publishPhase,
  statSchedule,
} from '../motion/src/scenes/como-melhorei/ArtigoReconhecido.tsx';
import { GLYPHS } from '../motion/src/scenes/como-melhorei/kit-b.tsx';
import { connectedCount, countLabel, entry as tudoEntry, HUB_KEYS, hubLayout } from '../motion/src/scenes/como-melhorei/TudoNaDio.tsx';
import { theme } from '../motion/src/theme.ts';

const SAFE_WIDTH = 1920 - theme.safe.x * 2;
const SAFE_HEIGHT = 1080 - theme.safe.y - CAPTION_ZONE;

describe('como-melhorei: contrato das cenas (lote b)', () => {
  it('cada cena tem sample real, duração e descrição', () => {
    const expected: [typeof alfredEntry, number, string[]][] = [
      [alfredEntry, 7, ['name', 'alfred', 'item1', 'item2', 'item3', 'item4']],
      [tudoEntry, 5, ['hub', 'courses', 'bootcamps', 'articles', 'ranking']],
      [artigoEntry, 8, ['article', 'publish', 'views', 'recognized']],
    ];
    for (const [entry, duration, keys] of expected) {
      expect(typeof entry.component).toBe('function');
      expect(entry.defaultDuration).toBe(duration);
      expect(entry.description.length).toBeGreaterThan(20);
      const revealAt = (entry.sample as { revealAt: Record<string, number> }).revealAt;
      expect(Object.keys(revealAt)).toEqual(keys);
      // tudo acontece dentro da cena, em ordem crescente
      const times = Object.values(revealAt);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(Math.max(...times)).toBeLessThan(duration);
    }
  });

  it('os ícones próprios são paths na grade 24x24', () => {
    for (const paths of Object.values(GLYPHS)) {
      expect(paths.length).toBeGreaterThan(0);
      for (const d of paths) expect(d).toMatch(/^M/);
    }
  });
});

describe('AlfredDio', () => {
  const revealAt = { name: 0.3, alfred: 2.0, item1: 3.4, item2: 4.0, item3: 4.6, item4: 5.2 };
  const times = serveTimes(revealAt);

  it('serve os quatro itens na ordem da fala', () => {
    expect(times).toEqual([3.4, 4.0, 4.6, 5.2]);
    expect(servedCount(0, times)).toBe(0);
    expect(servedCount(3.4, times)).toBe(1);
    expect(servedCount(4.7, times)).toBe(3);
    expect(servedCount(7, times)).toBe(4);
  });

  it('o sino toca a cada item e decai até zero', () => {
    expect(dingStrength(3.3, times)).toBe(0);
    expect(dingStrength(3.4, times)).toBe(1);
    expect(dingStrength(3.65, times)).toBeCloseTo(0.5);
    expect(dingStrength(3.95, times)).toBe(0);
    expect(dingStrength(4.0, times)).toBe(1);
    expect(dingStrength(6, times)).toBe(0);
    // toques sobrepostos: vale o mais forte
    expect(dingStrength(1.1, [1, 1.05], 0.5)).toBeCloseTo(0.9);
  });

  it('os cartões cabem na bandeja, sem sobrepor e dentro da margem', () => {
    const layout = serveLayout(SAFE_WIDTH);
    expect(layout.width).toBeLessThanOrEqual(SAFE_WIDTH);
    expect(layout.cardX).toHaveLength(4);
    expect(layout.cardX[0]).toBeGreaterThan(layout.bell.size);
    expect(layout.cardX[0]).toBeGreaterThanOrEqual(layout.tray.x);
    for (let index = 1; index < layout.cardX.length; index++) {
      expect(layout.cardX[index]! - layout.cardX[index - 1]!).toBeGreaterThan(layout.card.width);
    }
    const last = layout.cardX.at(-1)! + layout.card.width;
    expect(last).toBeLessThanOrEqual(layout.tray.x + layout.tray.width);
    expect(layout.tray.x + layout.tray.width).toBeCloseTo(layout.width);
    // a bandeja fica embaixo dos cartões e dentro da altura do bloco
    expect(layout.tray.y).toBeGreaterThan(layout.card.height);
    expect(layout.tray.y + layout.tray.lip).toBeLessThanOrEqual(layout.height);
    expect(layout.height).toBeLessThan(SAFE_HEIGHT);
  });

  it('a quantidade de itens muda a largura do cartão', () => {
    expect(serveLayout(SAFE_WIDTH, 3).card.width).toBeGreaterThan(serveLayout(SAFE_WIDTH, 4).card.width);
  });

  it('a bandeja é uma linha com as bordas levantadas', () => {
    expect(trayPath({ x: 100, y: 200, width: 500, lip: 20 })).toBe('M100 200 q0 20 20 20 H580 q20 0 20 -20');
  });
});

describe('TudoNaDio', () => {
  const revealAt = { hub: 0.3, courses: 1.0, bootcamps: 1.5, articles: 2.0, ranking: 2.5 };
  const layout = hubLayout(SAFE_WIDTH);

  it('conta quantas coisas já estão ligadas', () => {
    expect(connectedCount(0.5, revealAt)).toBe(0);
    expect(connectedCount(1.0, revealAt)).toBe(1);
    expect(connectedCount(2.2, revealAt)).toBe(3);
    expect(connectedCount(4.9, revealAt)).toBe(4);
    expect(countLabel(2)).toBe('2 de 4');
    expect(countLabel(9)).toBe('4 de 4');
    expect(countLabel(-1)).toBe('0 de 4');
  });

  it('hub no centro, um cartão em cada canto, tudo dentro da área útil', () => {
    expect(layout.hub.center).toEqual([SAFE_WIDTH / 2, layout.height / 2]);
    expect(layout.height).toBeLessThan(SAFE_HEIGHT - 200);
    expect(layout.nodes.courses).toMatchObject({ x: 0, y: 0 });
    expect(layout.nodes.ranking.x + layout.card.width).toBe(SAFE_WIDTH);
    expect(layout.nodes.ranking.y + layout.card.height).toBe(layout.height);
    expect(layout.nodes.bootcamps.y).toBe(0);
    expect(layout.nodes.articles.x).toBe(0);
  });

  it('cada ligação sai de fora do anel do hub e para antes do cartão', () => {
    const [cx, cy] = layout.hub.center;
    for (const key of HUB_KEYS) {
      const node = layout.nodes[key];
      const { from, to } = node.link;
      expect(Math.hypot(from[0] - cx, from[1] - cy)).toBeGreaterThan(layout.hub.ring);
      const left = node.x === 0;
      if (left) expect(to[0]).toBeGreaterThan(node.x + layout.card.width);
      else expect(to[0]).toBeLessThan(node.x);
      expect(to[1]).toBe(node.y + layout.card.height / 2);
    }
  });

  it('a pílula de contagem cabe entre os cartões de baixo, sem passar do bloco', () => {
    expect(layout.countY).toBeGreaterThan(layout.hub.center[1] + layout.hub.ring);
    expect(layout.countY + 70).toBeLessThanOrEqual(layout.height);
    const middle = layout.nodes.ranking.x - layout.card.width;
    expect(middle).toBeGreaterThan(layout.hub.ring * 2 + 200);
  });
});

describe('ArtigoReconhecido', () => {
  it('o botão afunda, volta e troca para "Publicado" no meio do aperto', () => {
    expect(publishPhase(2.0, 2.2)).toEqual({ press: 0, swap: 0, published: false });
    const mid = publishPhase(2.35, 2.2);
    expect(mid.press).toBeCloseTo(1);
    expect(mid.swap).toBeCloseTo(0);
    expect(publishPhase(2.36, 2.2).published).toBe(true);
    expect(publishPhase(2.275, 2.2).press).toBeCloseTo(0.5);
    expect(publishPhase(2.275, 2.2).published).toBe(false);
    const done = publishPhase(3, 2.2);
    expect(done).toEqual({ press: 0, swap: 1, published: true });
  });

  it('o corpo do artigo se escreve antes do clique em publicar', () => {
    const times = bodyLineTimes(0.4, 2.2);
    expect(times).toHaveLength(BODY_LINES.length);
    expect(times[0]).toBeCloseTo(0.9);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times.at(-1)!).toBeLessThanOrEqual(2.2 - 0.5 + 1e-9);
    // publicar cedo demais não inverte a ordem
    expect(bodyLineTimes(0.4, 0.6)).toEqual([0.9, 0.9, 0.9]);
  });

  it('os contadores entram escalonados e terminam juntos, antes do selo', () => {
    const schedule = statSchedule(3.8, 6.0);
    expect(schedule.map((slot) => slot.atSec)).toEqual([3.8, 4.05, 4.3]);
    for (const slot of schedule) expect(slot.atSec + slot.durationSec).toBeCloseTo(5.8);
    // selo colado nas leituras: a contagem ainda tem tempo mínimo
    for (const slot of statSchedule(3.8, 3.9)) expect(slot.durationSec).toBeGreaterThanOrEqual(0.6);
  });

  it('artigo e contadores têm a mesma altura e cabem na área útil com o selo', () => {
    const layout = articleLayout();
    expect(layout.width).toBe(layout.card.width + layout.gap + layout.stat.width);
    expect(layout.width).toBeLessThanOrEqual(SAFE_WIDTH);
    expect(layout.card.height).toBe(layout.stat.height * 3 + layout.stat.gap * 2);
    // eyebrow + espaço + bloco + espaço + selo
    expect(41 + 40 + layout.height + 44 + 124).toBeLessThanOrEqual(SAFE_HEIGHT);
  });
});
