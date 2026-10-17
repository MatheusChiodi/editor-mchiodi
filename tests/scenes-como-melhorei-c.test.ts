import { describe, expect, it } from 'vitest';

import type { ComponentEntry } from '../motion/src/components/registry.ts';
import { isIconName } from '../motion/src/scene-kit/icons.tsx';
import {
  badgeFlip,
  badgeLayout,
  badgeX,
  benefitTimes,
  EMBAIXADOR_REVEAL,
  entry as embaixador,
  UNLOCK_DELAY,
} from '../motion/src/scenes/como-melhorei/Embaixador.tsx';
import {
  capeSway,
  entry as liga,
  heroTimes,
  leagueLayout,
  leagueLift,
  LIGA_HEROES,
  LIGA_REVEAL,
  MAX_HEROES,
} from '../motion/src/scenes/como-melhorei/LigaDosDevs.tsx';
import { entry as naoAcabou, hop, markerAt, NAO_ACABOU_REVEAL, stairLayout } from '../motion/src/scenes/como-melhorei/NaoAcabou.tsx';

const FPS = 30;
const AREA = { width: 1728, height: 836 };

function expectEntry(entry: ComponentEntry, duration: number, reveal: Record<string, number>) {
  expect(typeof entry.component).toBe('function');
  expect(entry.defaultDuration).toBe(duration);
  expect(entry.description.length).toBeGreaterThan(20);
  expect(entry.sample).toEqual({ revealAt: reveal });
  // todo elemento entra antes do fim da cena, com folga para a animação terminar
  for (const time of Object.values(reveal)) expect(time).toBeLessThan(duration - 0.9);
}

describe('cena como-melhorei/LigaDosDevs', () => {
  it('entry cumpre o contrato e traz os tempos pedidos', () => {
    expectEntry(liga, 6.8, { hero1: 0.5, hero2: 0.9, hero3: 1.3, hero4: 1.7, hero5: 2.1, title: 3.0, grow: 4.6 });
  });

  it('cinco heróis com ícones do kit e rótulos únicos', () => {
    expect(LIGA_HEROES).toHaveLength(MAX_HEROES);
    expect(new Set(LIGA_HEROES.map((hero) => hero.label)).size).toBe(MAX_HEROES);
    for (const hero of LIGA_HEROES) expect(isIconName(hero.icon)).toBe(true);
  });

  it('heroTimes segue a ordem da fila e respeita a quantidade', () => {
    expect(heroTimes(LIGA_REVEAL)).toEqual([0.5, 0.9, 1.3, 1.7, 2.1]);
    expect(heroTimes(LIGA_REVEAL, 3)).toEqual([0.5, 0.9, 1.3]);
    expect(heroTimes(LIGA_REVEAL, 9)).toHaveLength(MAX_HEROES);
    expect(heroTimes(LIGA_REVEAL, -1)).toEqual([]);
  });

  it('leagueLayout centraliza a fila dentro da área útil, sem colunas sobrepostas', () => {
    const layout = leagueLayout(5, AREA.width);
    expect(layout.slots).toHaveLength(5);
    const first = layout.slots[0]!;
    const last = layout.slots[4]!;
    expect(first.x).toBeGreaterThanOrEqual(0);
    expect(last.x + layout.column).toBeLessThanOrEqual(AREA.width);
    expect(first.x).toBeCloseTo(AREA.width - (last.x + layout.column));
    for (let index = 1; index < 5; index++) expect(layout.slots[index]!.x).toBeGreaterThanOrEqual(layout.slots[index - 1]!.x + layout.column);
  });

  it('o herói do meio é o maior e a formação é simétrica', () => {
    const { slots, column } = leagueLayout(5, AREA.width);
    expect(slots[2]!.scale).toBe(1);
    expect(slots[0]!.scale).toBeCloseTo(slots[4]!.scale);
    expect(slots[1]!.scale).toBeGreaterThan(slots[0]!.scale);
    for (const slot of slots) {
      expect(slot.figure.width).toBeLessThanOrEqual(column);
      expect(slot.figure.height / slot.figure.width).toBeCloseTo(1.3);
    }
  });

  it('a seta "crescendo juntos" sobe da esquerda para a direita, dentro da faixa', () => {
    const { grow } = leagueLayout(5, AREA.width);
    expect(grow.to[0]).toBeGreaterThan(grow.from[0]);
    expect(grow.to[1]).toBeLessThan(grow.from[1]);
    for (const y of [grow.from[1], grow.to[1], grow.label[1]]) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(grow.height);
    }
    expect(grow.label[0]).toBe(AREA.width / 2);
  });

  it('título + fila + seta cabem na área útil (acima da faixa das legendas)', () => {
    const layout = leagueLayout(5, AREA.width);
    expect(166 + layout.rowHeight + layout.grow.height + 36 * 2).toBeLessThanOrEqual(AREA.height);
  });

  it('funciona com menos heróis', () => {
    const layout = leagueLayout(3, AREA.width);
    expect(layout.slots).toHaveLength(3);
    expect(layout.slots[1]!.scale).toBe(1);
    expect(leagueLayout(0, AREA.width).slots).toEqual([]);
  });

  it('capeSway é determinístico, limitado e fora de fase entre vizinhos', () => {
    expect(capeSway(40, FPS, 1)).toBe(capeSway(40, FPS, 1));
    expect(capeSway(40, FPS, 0)).not.toBe(capeSway(40, FPS, 1));
    for (let frame = 0; frame < 200; frame += 7) expect(Math.abs(capeSway(frame, FPS, 2, 5))).toBeLessThanOrEqual(5);
  });

  it('leagueLift centraliza a fila antes do título e zera depois', () => {
    expect(leagueLift(1)).toBeCloseTo(0);
    expect(leagueLift(0)).toBeLessThan(0);
    expect(Math.abs(leagueLift(0))).toBeLessThan(60);
  });
});

describe('cena como-melhorei/Embaixador', () => {
  it('entry cumpre o contrato e traz os tempos pedidos', () => {
    expectEntry(embaixador, 7, { badge: 0.5, better: 2.8, mentoring: 4.4, competitions: 5.2, community: 5.8 });
  });

  it('crachá e coluna de benefícios cabem lado a lado na área útil', () => {
    const layout = badgeLayout(AREA.width, AREA.height);
    const { badge, column, row } = layout;
    expect(badge.restX).toBeGreaterThanOrEqual(0);
    expect(badge.top).toBeGreaterThan(0);
    expect(badge.top + badge.height).toBeLessThanOrEqual(AREA.height);
    expect(column.x).toBeGreaterThan(badge.restX + badge.width);
    expect(column.x + column.width).toBeLessThanOrEqual(AREA.width);
    const columnHeight = 86 + 52 + row.height * 3 + row.gap * 2;
    expect(column.top).toBeGreaterThanOrEqual(0);
    expect(column.top + columnHeight).toBeLessThanOrEqual(AREA.height);
    // o último degrau de benefício ainda tem largura para o rótulo
    expect(column.width - row.indent * 2).toBeGreaterThan(500);
  });

  it('badgeX começa no centro e termina encostado à esquerda', () => {
    const layout = badgeLayout(AREA.width, AREA.height);
    expect(badgeX(layout, 0)).toBe((AREA.width - layout.badge.width) / 2);
    expect(badgeX(layout, 1)).toBe(layout.badge.restX);
    expect(badgeX(layout, 0.5)).toBeGreaterThan(layout.badge.restX);
    expect(badgeX(layout, 0.5)).toBeLessThan(badgeX(layout, 0));
  });

  it('badgeFlip entra de costas e só mostra a frente depois de 90°', () => {
    expect(badgeFlip(0)).toEqual({ angle: 180, front: false });
    expect(badgeFlip(0.5).front).toBe(false);
    expect(badgeFlip(0.51).front).toBe(true);
    expect(badgeFlip(1)).toEqual({ angle: 0, front: true });
    expect(badgeFlip(2).angle).toBe(0);
    expect(badgeFlip(-1).angle).toBe(180);
  });

  it('benefitTimes mantém a ordem da fala e destrava logo depois de aparecer', () => {
    const benefits = benefitTimes(EMBAIXADOR_REVEAL, ['Mentorias', 'Competições', 'Comunidade']);
    expect(benefits.map((benefit) => benefit.key)).toEqual(['mentoring', 'competitions', 'community']);
    expect(benefits.map((benefit) => benefit.label)).toEqual(['Mentorias', 'Competições', 'Comunidade']);
    expect(benefits.map((benefit) => benefit.at)).toEqual([4.4, 5.2, 5.8]);
    for (const benefit of benefits) {
      expect(benefit.unlockAt).toBeCloseTo(benefit.at + UNLOCK_DELAY);
      expect(benefit.unlockAt + 0.4).toBeLessThan(embaixador.defaultDuration);
    }
  });
});

describe('cena como-melhorei/NaoAcabou', () => {
  const layout = stairLayout(AREA.width, AREA.height);

  it('entry cumpre o contrato e traz os tempos pedidos', () => {
    expectEntry(naoAcabou, 7.5, { student: 0.4, expert: 1.4, end: 3.0, notEnd: 4.4, alumni: 5.6 });
  });

  it('três degraus subindo para a direita, apoiados no chão e sem sobreposição', () => {
    const [student, expert, alumni] = layout.steps;
    expect(layout.baseline).toBeLessThanOrEqual(AREA.height);
    expect(expert.height).toBeGreaterThan(student.height);
    expect(alumni.height).toBeGreaterThan(expert.height);
    for (const step of layout.steps) {
      expect(step.top + step.height).toBe(layout.baseline);
      expect(step.x).toBeGreaterThanOrEqual(0);
      expect(step.top).toBeGreaterThan(0);
    }
    expect(expert.x).toBeGreaterThanOrEqual(student.x + student.width);
    expect(alumni.x).toBeGreaterThanOrEqual(expert.x + expert.width);
  });

  it('o bonequinho fica em cima de cada degrau, sem encostar nele', () => {
    layout.anchors.forEach((anchor, index) => {
      const step = layout.steps[index]!;
      expect(anchor[0]).toBeGreaterThan(step.x + layout.marker / 2);
      expect(anchor[0]).toBeLessThan(step.x + step.width - layout.marker / 2);
      expect(anchor[1] + layout.marker / 2).toBeLessThan(step.top);
      expect(anchor[1] - layout.marker / 2).toBeGreaterThan(0);
    });
  });

  it('a placa "Fim?" fica no fim do segundo degrau, sem bater no bonequinho nem no degrau Alumni', () => {
    const { sign, steps, anchors, marker } = layout;
    expect(sign.bottom).toBe(steps[1].top);
    expect(sign.centerX - sign.width / 2).toBeGreaterThan(anchors[1][0] + marker / 2);
    expect(sign.centerX + sign.width / 2).toBeLessThanOrEqual(steps[1].x + steps[1].width);
    // o título ocupa o alto à esquerda (até ~190 px): a placa fica abaixo dele
    expect(sign.bottom - sign.post - 96).toBeGreaterThan(200);
  });

  it('a trilha continua para cima e para a direita depois do Alumni, dentro da área útil', () => {
    const { trail, steps } = layout;
    expect(trail.from[0]).toBeGreaterThan(steps[2].x + steps[2].width);
    expect(trail.to[0]).toBeGreaterThan(trail.from[0]);
    expect(trail.to[1]).toBeLessThan(trail.from[1]);
    expect(trail.to[0]).toBeLessThanOrEqual(AREA.width);
    expect(trail.to[1]).toBeGreaterThan(0);
    expect(trail.label[1]).toBeGreaterThan(trail.from[1]);
    expect(trail.label[0]).toBeLessThan(AREA.width - 160);
  });

  it('hop sai de um ponto, chega no outro e sobe no meio', () => {
    expect(hop([0, 100], [200, 40], 0)).toEqual([0, 100]);
    const end = hop([0, 100], [200, 40], 1);
    expect(end[0]).toBe(200);
    expect(end[1]).toBeCloseTo(40);
    const middle = hop([0, 100], [200, 40], 0.5, 70);
    expect(middle[0]).toBe(100);
    expect(middle[1]).toBeCloseTo(0);
    expect(hop([0, 0], [10, 0], 5)[0]).toBe(10);
  });

  it('markerAt: parado no aluno, depois no Campus Expert, depois no Alumni', () => {
    const reveal = NAO_ACABOU_REVEAL;
    const [a, b, c] = layout.anchors;
    expect(markerAt(0, FPS, reveal, layout.anchors)).toEqual([a[0], a[1]]);
    expect(markerAt(reveal.expert * FPS, FPS, reveal, layout.anchors)).toEqual([a[0], a[1]]);
    const onExpert = markerAt(reveal.end * FPS, FPS, reveal, layout.anchors);
    expect(onExpert[0]).toBeCloseTo(b[0]);
    expect(onExpert[1]).toBeCloseTo(b[1]);
    const midAir = markerAt((reveal.alumni + 0.5) * FPS, FPS, reveal, layout.anchors);
    expect(midAir[0]).toBeGreaterThan(b[0]);
    expect(midAir[0]).toBeLessThan(c[0]);
    expect(midAir[1]).toBeLessThan(b[1]);
    const onAlumni = markerAt(7.2 * FPS, FPS, reveal, layout.anchors);
    expect(onAlumni[0]).toBeCloseTo(c[0]);
    expect(onAlumni[1]).toBeCloseTo(c[1]);
  });
});
