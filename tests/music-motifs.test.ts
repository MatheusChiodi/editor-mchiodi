import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MOTIFS, type MotifProps } from '../motion/src/music/motifs.tsx';
import { MOOD_IDS, MOTIF_IDS, POSE_IDS, PROP_IDS, SETTING_IDS, TIME_IDS, WEATHER_IDS, type Shot } from '../motion/src/music/types.ts';

const base: MotifProps = {
  frame: 0,
  fps: 30,
  progress: 0,
  palette: ['#0b1020', '#7c93ff', '#9dffce'],
  bass: 0.5,
  pulse: 0.5,
  variant: 0,
  keyword: 'mensagem',
  seed: 3,
};

const markup = (motif: (typeof MOTIF_IDS)[number], overrides: Partial<MotifProps> = {}) => renderToStaticMarkup(createElement('svg', null, createElement(MOTIFS[motif], { ...base, ...overrides })));

describe('MOTIFS', () => {
  it('há um desenho para cada motivo do plano', () => {
    expect(Object.keys(MOTIFS).sort()).toEqual([...MOTIF_IDS].sort());
  });

  for (const motif of MOTIF_IDS.filter((id) => id !== 'story')) {
    it(`${motif}: gera SVG em qualquer quadro, variante e progresso, sem NaN`, () => {
      for (const frame of [0, 7, 45, 200, 1500]) {
        for (const variant of [0, 1, 2]) {
          const out = markup(motif, { frame, variant, progress: Math.min(1, frame / 240), bass: frame % 2 ? 0 : 1, pulse: variant / 2 });
          expect(out.length).toBeGreaterThan(80);
          expect(out.includes('NaN'), `NaN em out`).toBe(false);
          expect(out.includes('undefined'), `undefined em out`).toBe(false);
          expect(out.includes('Infinity'), `Infinity em out`).toBe(false);
        }
      }
    });
  }

  it('é determinístico: mesma entrada, mesmo desenho; seed diferente muda o sorteio', () => {
    expect(markup('rain', { frame: 30 })).toBe(markup('rain', { frame: 30 }));
    expect(markup('night', { seed: 1 })).not.toBe(markup('night', { seed: 2 }));
  });

  it('as palavras destacam a palavra da letra, em caixa alta', () => {
    expect(markup('words', { keyword: 'silêncio', frame: 30 })).toContain('SILÊNCIO');
  });

  it('o celular digita e apaga: a caixa de texto cresce e volta a zero', () => {
    const width = (frame: number) => Number(/<rect x="-100" y="207" width="([\d.]+)"/.exec(markup('phone', { frame }))![1]);
    expect(width(0)).toBe(0);
    expect(width(Math.round(1.2 * 30))).toBeGreaterThan(100);
    expect(width(Math.round(3.0 * 30))).toBe(0);
  });

  it('o coração parte ao longo da cena: a rachadura aparece depois da metade', () => {
    const dash = (progress: number) => Number(/stroke-dashoffset="([\d.]+)"/.exec(markup('heart', { progress }))![1]);
    expect(dash(0.9)).toBeLessThan(dash(0.1));
  });
});

describe('story (personagem num cenário)', () => {
  const shot = (overrides: Partial<Shot> = {}): Shot => ({ setting: 'bedroom', time: 'night', weather: 'clear', pose: 'sit', mood: 'sad', props: [], ...overrides });
  const draw = (s: Shot, frame = 30, progress = 0.4) => markup('story', { shot: s, frame, progress });

  it('sem plano de história não desenha nada (não quebra)', () => {
    expect(markup('story', { shot: undefined })).toBe('<svg></svg>');
  });

  it('todo cenário, em todo horário e clima, gera SVG válido', () => {
    for (const setting of SETTING_IDS) {
      for (const time of TIME_IDS) {
        for (const weather of WEATHER_IDS) {
          const out = draw(shot({ setting, time, weather }));
          expect(out.length).toBeGreaterThan(500);
          expect(out.includes('NaN'), `NaN em out`).toBe(false);
          expect(out.includes('undefined'), `undefined em out`).toBe(false);
          expect(out.includes('Infinity'), `Infinity em out`).toBe(false);
        }
      }
    }
    // 84 cenários completos (7 × 4 horários × 3 climas): passa dos 5 s padrão em máquina carregada
  }, 60_000);

  it('toda pose e humor, com todos os objetos, gera SVG válido em vários momentos', () => {
    for (const pose of POSE_IDS) {
      for (const mood of MOOD_IDS) {
        for (const frame of [0, 21, 95]) {
          const out = draw(shot({ pose, mood, props: [...PROP_IDS], setting: pose === 'walk' ? 'street' : 'bedroom' }), frame, frame / 120);
          expect(out.includes('NaN'), `NaN em out`).toBe(false);
          expect(out.includes('undefined'), `undefined em out`).toBe(false);
        }
      }
    }
    // 180 desenhos completos do personagem: passa dos 5 s padrão em máquina carregada
  }, 60_000);

  it('o plano de janela não tem personagem; os outros têm (contorno de desenho)', () => {
    const outline = '#0b0f1a';
    expect(draw(shot({ setting: 'window' }))).not.toContain(outline);
    expect(draw(shot({ setting: 'street', pose: 'walk' }))).toContain(outline);
  });

  it('andar atravessa o quadro: a posição muda ao longo da cena', () => {
    const at = (progress: number) => draw(shot({ setting: 'street', pose: 'walk', mood: 'sad' }), 30, progress);
    expect(at(0.1)).not.toBe(at(0.9));
  });

  it('chorando aparecem lágrimas; neutro, não', () => {
    const drops = (mood: Shot['mood']) => (draw(shot({ pose: 'lookDown', mood })).match(/#8fd3ff/g) ?? []).length;
    expect(drops('cry')).toBeGreaterThan(0);
    expect(drops('neutral')).toBe(0);
  });

  it('chuva aparece só quando o clima é chuva', () => {
    const streaks = (weather: Shot['weather']) => (draw(shot({ setting: 'street', pose: 'stand', weather })).match(/stroke="#bfd8ff"/g) ?? []).length;
    expect(streaks('rain')).toBeGreaterThan(100);
    expect(streaks('clear')).toBe(0);
  });

  it('é determinístico', () => {
    expect(draw(shot({ setting: 'park' }))).toBe(draw(shot({ setting: 'park' })));
  });
});
