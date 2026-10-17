import { describe, expect, it } from 'vitest';

import { presence, progressAt, stagger } from '../motion/src/anim.ts';
import { buildTimelineSvg, sourceBands, VIEW, VIEW_HEIGHT, viewPath } from '../src/analyze/timeline-view.ts';

describe('buildTimelineSvg', () => {
  const svg = buildTimelineSvg({
    title: 'aula <1> & cia',
    from: 10,
    to: 14,
    words: [
      { text: 'antes', start: 8, end: 9 },
      { text: 'React', start: 11, end: 11.5 },
      { text: '"hooks"', start: 12, end: 12.4 },
    ],
    bands: [
      { start: 10.5, end: 11, kind: 'removed' },
      { start: 20, end: 30, kind: 'kept' },
    ],
    markers: [
      { at: 12, label: 'corte' },
      { at: 99, label: 'fora' },
    ],
  });

  it('tem o tamanho da composição final', () => {
    expect(svg).toContain(`width="${VIEW.width}" height="${VIEW_HEIGHT}"`);
  });

  it('posiciona cada palavra proporcionalmente ao tempo e ignora as fora do intervalo', () => {
    expect(svg).toContain(`x="${(VIEW.width / 4 + 2).toFixed(1)}"`);
    expect(svg).toContain('>React<');
    expect(svg).not.toContain('>antes<');
  });

  it('escapa texto para XML', () => {
    expect(svg).toContain('aula &lt;1&gt; &amp; cia');
    expect(svg).toContain('&quot;hooks&quot;');
  });

  it('desenha só faixas e marcadores dentro do intervalo', () => {
    expect(svg.match(/rgba\(255,85,85,0\.38\)/g)).toHaveLength(1);
    expect(svg).not.toContain('rgba(52,211,153,0.22)');
    expect(svg).toContain('>corte<');
    expect(svg).not.toContain('>fora<');
  });

  it('a régua tem no máximo 16 marcações', () => {
    const wide = buildTimelineSvg({ title: 't', from: 0, to: 600, words: [], bands: [], markers: [] });
    expect((wide.match(/text-anchor="middle"/g) ?? []).length).toBeLessThanOrEqual(17);
  });
});

describe('sourceBands', () => {
  it('sem EDL devolve só os silêncios', () => {
    expect(sourceBands([{ start: 1, end: 2 }], null)).toEqual([{ start: 1, end: 2, kind: 'silence' }]);
  });

  it('com EDL cobre a fonte inteira entre mantido e removido', () => {
    const bands = sourceBands([], {
      clips: [
        { start: 1, end: 4 },
        { start: 6, end: 9 },
      ],
      source: { durationSec: 10 },
    });
    expect(bands).toEqual([
      { start: 0, end: 1, kind: 'removed' },
      { start: 1, end: 4, kind: 'kept' },
      { start: 4, end: 6, kind: 'removed' },
      { start: 6, end: 9, kind: 'kept' },
      { start: 9, end: 10, kind: 'removed' },
    ]);
  });
});

describe('viewPath', () => {
  it('nomeia pelo intervalo', () => {
    expect(viewPath('d', 1.5, 3, 'out').replace(/\\/g, '/')).toBe('d/view-out-1.50-3.00.png');
  });
});

describe('motion/anim', () => {
  it('presence sobe na entrada, fica em 1 e zera na saída', () => {
    expect(presence(0, 30, 90).value).toBe(0);
    expect(presence(45, 30, 90).value).toBe(1);
    expect(presence(90, 30, 90).value).toBe(0);
    const entering = presence(3, 30, 90).value;
    expect(entering).toBeGreaterThan(0);
    expect(entering).toBeLessThan(1);
  });

  it('progressAt respeita o atraso e trava em 0..1', () => {
    expect(progressAt(10, 30, 1)).toBe(0);
    expect(progressAt(300, 30, 1)).toBe(1);
    expect(progressAt(36, 30, 1, 0.4)).toBeGreaterThan(0.5);
  });

  it('stagger escalona os itens', () => {
    expect(stagger(0)).toBe(0);
    expect(stagger(3, 0.5, 1)).toBe(2.5);
  });
});
