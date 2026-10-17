import { describe, expect, it } from 'vitest';

import type { ComponentEntry } from '../motion/src/components/registry.ts';
import { CAPTION_ZONE } from '../motion/src/scene-kit/tokens.ts';
import { entry as deCoracao, heartbeat, PILL_HEIGHT, strikeLine, swapLayout } from '../motion/src/scenes/como-melhorei/DeCoracao.tsx';
import {
  cyclePoint,
  entry as estudarEPraticar,
  levelFill,
  levelNumber,
  MAX_LEVEL,
  quadPoint,
  STALL_LEVEL,
  stallAttempt,
  studyLayout,
} from '../motion/src/scenes/como-melhorei/EstudarEPraticar.tsx';
import { GLYPHS } from '../motion/src/scenes/como-melhorei/glyphs-d.tsx';
import { bubblePosition, bubbleTimes, BUBBLE_TRAVEL, callLayout, entry as mentoriaAoVivo } from '../motion/src/scenes/como-melhorei/MentoriaAoVivo.tsx';
import { theme } from '../motion/src/theme.ts';

const USABLE_WIDTH = 1920 - theme.safe.x * 2;
const USABLE_HEIGHT = 1080 - theme.safe.y - CAPTION_ZONE;

function expectEntry(entry: ComponentEntry, duration: number, keys: string[]) {
  expect(typeof entry.component).toBe('function');
  expect(entry.defaultDuration).toBe(duration);
  expect(entry.description.length).toBeGreaterThan(20);
  const reveal = (entry.sample as { revealAt: Record<string, number> }).revealAt;
  expect(Object.keys(reveal)).toEqual(keys);
  const times = Object.values(reveal);
  expect([...times].sort((a, b) => a - b)).toEqual(times);
  expect(times.at(-1)).toBeLessThan(duration);
}

describe('como-melhorei: ícones', () => {
  it('todo ícone tem ao menos um path', () => {
    for (const paths of Object.values(GLYPHS)) {
      expect(paths.length).toBeGreaterThan(0);
      for (const d of paths) expect(d).toMatch(/^M/);
    }
  });
});

describe('como-melhorei/MentoriaAoVivo', () => {
  it('entry com os tempos pedidos', () => {
    expectEntry(mentoriaAoVivo, 7, ['dream', 'call', 'live', 'wow']);
    expect((mentoriaAoVivo.sample as { revealAt: unknown }).revealAt).toEqual({ dream: 0.3, call: 2.6, live: 4.2, wow: 5.6 });
  });

  it('a janela cabe na área útil, centralizada, com os dois quadros lado a lado', () => {
    const layout = callLayout(USABLE_WIDTH);
    expect(layout.height).toBeLessThanOrEqual(USABLE_HEIGHT);
    expect(layout.window.x * 2 + layout.window.width).toBe(USABLE_WIDTH);
    expect(layout.window.y + layout.window.height).toBeLessThan(layout.wowY);
    expect(layout.wowY + 100).toBeLessThanOrEqual(layout.height);
    expect(layout.meTileX).toBeGreaterThan(layout.mentorTileX + layout.tile.width);
    expect(layout.meTileX + layout.tile.width).toBeLessThan(layout.window.width);
    expect(layout.tile.y + layout.tile.height).toBeLessThan(layout.window.height);
  });

  it('os balões viajam entre os avatares sem cobri-los, cada um na sua faixa', () => {
    const layout = callLayout(USABLE_WIDTH);
    expect(layout.travel.fromX).toBeGreaterThan(layout.mentor[0] + layout.avatar / 2);
    expect(layout.travel.toX).toBeLessThan(layout.me[0] - layout.avatar / 2);
    expect(layout.lanes).toHaveLength(3);
    expect(layout.lanes[1]).toBe(layout.mentor[1]);
    expect(layout.lanes[0]).toBeGreaterThan(layout.tile.y + 36);
    expect(layout.lanes[2]).toBeLessThan(layout.tile.y + layout.tile.height - 36);
    expect(callLayout(USABLE_WIDTH, 1).lanes).toEqual([layout.mentor[1]]);
  });

  it('bubblePosition: sai encostado em quem fala e chega encostado em quem ouve', () => {
    const travel = { fromX: 100, toX: 900 };
    expect(bubblePosition(0, 'mentor', travel)).toEqual({ left: 100, shift: -0 });
    expect(bubblePosition(1, 'mentor', travel)).toEqual({ left: 900, shift: -100 });
    expect(bubblePosition(0, 'me', travel)).toEqual({ left: 900, shift: -100 });
    expect(bubblePosition(1, 'me', travel)).toEqual({ left: 100, shift: -0 });
    expect(bubblePosition(0.5, 'mentor', travel).left).toBe(500);
  });

  it('os balões saem em sequência depois do "ao vivo" e terminam antes do fim da cena', () => {
    const times = bubbleTimes(3, 4.2);
    expect(times[0]).toBeGreaterThan(4.2);
    expect(times[1]).toBeGreaterThan(times[0]!);
    expect(times[2]! + BUBBLE_TRAVEL).toBeLessThan(7);
    expect(bubbleTimes(0, 1)).toEqual([]);
  });
});

describe('como-melhorei/DeCoracao', () => {
  it('entry com os tempos pedidos', () => {
    expectEntry(deCoracao, 6.5, ['heart', 'sponsored', 'strike', 'sincere']);
    expect((deCoracao.sample as { revealAt: unknown }).revealAt).toEqual({ heart: 0.4, sponsored: 2.6, strike: 3.6, sincere: 4.8 });
  });

  it('swapLayout: etiqueta sozinha no centro; depois da troca, as duas cabem com a seta no meio', () => {
    const layout = swapLayout();
    expect(layout.width).toBeLessThanOrEqual(USABLE_WIDTH);
    expect(layout.soloX * 2 + layout.sponsoredWidth).toBe(layout.width);
    expect(layout.sponsoredX).toBe(0);
    expect(layout.sincereX + layout.sincereWidth).toBe(layout.width);
    expect(layout.arrow.from[0]).toBeGreaterThan(layout.sponsoredWidth);
    expect(layout.arrow.to[0]).toBeLessThan(layout.sincereX);
    expect(layout.arrow.to[0] - layout.arrow.from[0]).toBeGreaterThan(60);
    expect(layout.arrow.from[1]).toBe(PILL_HEIGHT / 2);
  });

  it('strikeLine atravessa a etiqueta inteira, subindo da esquerda para a direita', () => {
    const line = strikeLine(400, 84);
    expect(line.from[0]).toBeLessThan(0);
    expect(line.to[0]).toBeGreaterThan(400);
    expect(line.from[1]).toBeGreaterThan(line.to[1]);
    expect((line.from[1] + line.to[1]) / 2).toBe(42);
    expect(line.length).toBeGreaterThan(400);
  });

  it('heartbeat: repouso em 1, duas batidas e a segunda mais fraca', () => {
    expect(heartbeat(0, 1)).toBe(1);
    expect(heartbeat(1, 1)).toBe(1);
    expect(heartbeat(5, 1)).toBe(1);
    const first = heartbeat(1.16, 1);
    const second = heartbeat(1.36 + 0.16, 1);
    expect(first).toBeCloseTo(1.07, 5);
    expect(second).toBeGreaterThan(1);
    expect(second).toBeLessThan(first);
  });
});

describe('como-melhorei/EstudarEPraticar', () => {
  const reveal = { study: 1.2, notOnly: 3.4, practice: 6.4, loop: 7.6 };

  it('entry com os tempos pedidos', () => {
    expectEntry(estudarEPraticar, 9, ['study', 'notOnly', 'practice', 'loop']);
    expect((estudarEPraticar.sample as { revealAt: unknown }).revealAt).toEqual(reveal);
  });

  it('layout: estudar, praticar e medidor em ordem, sem sobreposição e dentro da largura', () => {
    const layout = studyLayout(USABLE_WIDTH);
    const half = layout.badge / 2;
    expect(layout.study[0] - 220).toBeGreaterThanOrEqual(0);
    expect(layout.path.from[0]).toBeGreaterThan(layout.study[0] + half);
    expect(layout.path.to[0]).toBeLessThan(layout.practice[0] - half);
    expect(layout.stop.x).toBeGreaterThan(layout.path.to[0]);
    expect(layout.stop.x).toBeLessThan(layout.practice[0] - half);
    expect(layout.practice[0] + 220).toBeLessThan(layout.meter.x);
    expect(layout.meter.x + layout.meter.width).toBe(USABLE_WIDTH);
    expect(layout.meter.y + layout.meter.height).toBeLessThanOrEqual(layout.height);
    expect(layout.labelY).toBeGreaterThan(layout.study[1] + half);
  });

  it('quadPoint passa pelos extremos e pelo desvio no meio', () => {
    expect(quadPoint([0, 0], [100, 0], -40, 0)).toEqual([0, 0]);
    expect(quadPoint([0, 0], [100, 0], -40, 1)).toEqual([100, 0]);
    const middle = quadPoint([0, 0], [100, 0], -40, 0.5);
    expect(middle[0]).toBeCloseTo(50, 6);
    expect(middle[1]).toBeCloseTo(-40, 6);
  });

  it('cyclePoint: ida por cima, volta por baixo, e fecha a volta', () => {
    const layout = studyLayout(USABLE_WIDTH);
    expect(cyclePoint(0, layout)).toEqual(layout.go.from);
    expect(cyclePoint(0.5, layout)).toEqual(layout.back.from);
    expect(cyclePoint(0.25, layout)[1]).toBeLessThan(layout.study[1]);
    expect(cyclePoint(0.75, layout)[1]).toBeGreaterThan(layout.study[1]);
    expect(cyclePoint(1.25, layout)).toEqual(cyclePoint(0.25, layout));
    expect(cyclePoint(-0.75, layout)).toEqual(cyclePoint(0.25, layout));
  });

  it('stallAttempt: invisível antes de começar, chega no bloqueio e some, e se repete', () => {
    expect(stallAttempt(0, 2)).toEqual({ travel: 0, opacity: 0 });
    expect(stallAttempt(2, 2, 1).opacity).toBe(0);
    const arrived = stallAttempt(2.62, 2, 1);
    expect(arrived.travel).toBe(1);
    expect(arrived.opacity).toBe(1);
    expect(stallAttempt(2.97, 2, 1).opacity).toBe(0);
    expect(stallAttempt(3.3, 2, 1).travel).toBeCloseTo(stallAttempt(2.3, 2, 1).travel, 6);
  });

  it('levelFill: sobe pouco, estaciona enquanto é só estudo e enche quando o ciclo fecha', () => {
    expect(levelFill(0, reveal)).toBe(0);
    expect(levelFill(reveal.notOnly, reveal)).toBeCloseTo(STALL_LEVEL, 6);
    expect(levelFill(reveal.practice, reveal)).toBeCloseTo(STALL_LEVEL, 6);
    expect(levelFill(reveal.loop, reveal)).toBeCloseTo(STALL_LEVEL, 6);
    expect(levelFill(reveal.loop + 0.6, reveal)).toBeGreaterThan(STALL_LEVEL);
    expect(levelFill(reveal.loop + 1.2, reveal)).toBeCloseTo(1, 6);
    expect(levelFill(99, reveal)).toBeCloseTo(1, 6);
    // tempos colados não quebram a interpolação
    expect(Number.isFinite(levelFill(1, { study: 1, notOnly: 1, loop: 1 }))).toBe(true);
  });

  it('levelNumber vai de 0 ao máximo', () => {
    expect(levelNumber(0)).toBe(0);
    expect(levelNumber(STALL_LEVEL)).toBe(1);
    expect(levelNumber(1)).toBe(MAX_LEVEL);
    expect(levelNumber(2)).toBe(MAX_LEVEL);
    expect(levelNumber(-1)).toBe(0);
  });
});
