import { describe, expect, it } from 'vitest';

import { DEFAULT_FACE, FIT_PREFIX, fitZoom, planFit, screenPos, SUBJECT_HALF, withFit } from '../src/edl/fit.ts';
import type { Overlay, Zoom } from '../src/edl/schema.ts';

const overlay = (id: string, component: string, at: number, extra: Partial<Overlay> = {}): Overlay =>
  ({ id, component, at, duration: 5, props: {}, reason: 'teste', hidesCaptions: false, ...extra }) as Overlay;
const zoom = (id: string, at: number, duration = 3): Zoom => ({ id, at, duration, scale: 1.12, focus: { x: 0.5, y: 0.4 }, mode: 'ease', reason: 'manual' });

const RIGHT = { x: 0.53, y: 0.32, w: 0.42, h: 0.35 }; // cartão à direita, em cima do rosto central
const FOOT = { Checklist: RIGHT, TipCard: { x: 0.05, y: 0.8, w: 0.3, h: 0.1 }, Full: { x: 0, y: 0, w: 1, h: 0.9 }, Empty: null };

describe('screenPos (mesma conta do crop do zoom)', () => {
  it('zoom 1 não mexe; foco no ponto o mantém parado', () => {
    expect(screenPos(0.3, 1, 0.9)).toBeCloseTo(0.3);
    expect(screenPos(0.5, 1.2, 0.5)).toBeCloseTo(0.5);
  });
  it('foco 0 ancora a esquerda; foco 1, a direita', () => {
    expect(screenPos(0, 1.5, 0)).toBe(0);
    expect(screenPos(1, 1.5, 1)).toBe(1);
  });
});

describe('fitZoom', () => {
  it('leva o rosto para o lado livre e o sujeito sai da área ocupada', () => {
    const fit = fitZoom(RIGHT)!;
    expect(fit).not.toBeNull();
    expect(fit.scale).toBeGreaterThan(1);
    const center = screenPos(DEFAULT_FACE.x, fit.scale, fit.focus.x);
    const right = center + SUBJECT_HALF.x * fit.scale;
    expect(right).toBeLessThanOrEqual(RIGHT.x);
    expect(center - SUBJECT_HALF.x * fit.scale).toBeGreaterThanOrEqual(0);
  });
  it('mantém a altura do rosto', () => {
    const fit = fitZoom(RIGHT)!;
    expect(screenPos(DEFAULT_FACE.y, fit.scale, fit.focus.y)).toBeCloseTo(DEFAULT_FACE.y);
  });
  it('área à esquerda manda o rosto para a direita', () => {
    const fit = fitZoom({ x: 0.04, y: 0.3, w: 0.42, h: 0.35 })!;
    expect(screenPos(DEFAULT_FACE.x, fit.scale, fit.focus.x)).toBeGreaterThan(DEFAULT_FACE.x);
  });
  it('sem vão largo o bastante, não inventa: devolve null', () => {
    expect(fitZoom({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })).toBeNull();
  });
  it('rosto deslocado no quadro também é respeitado', () => {
    const face = { x: 0.4, y: 0.4 };
    const fit = fitZoom({ x: 0.5, y: 0.2, w: 0.3, h: 0.5 }, face)!;
    expect(screenPos(face.x, fit.scale, fit.focus.x) + SUBJECT_HALF.x * fit.scale).toBeLessThanOrEqual(0.5);
  });
});

describe('planFit', () => {
  it('gráfico sobre o rosto gera zoom fit-<id> com a janela do overlay', () => {
    const [item] = planFit({ overlays: [overlay('lista', 'Checklist', 20)], zooms: [] }, FOOT);
    expect(item!.status).toBe('ajustado');
    expect(item!.zoom).toMatchObject({ id: `${FIT_PREFIX}lista`, at: 20, duration: 5, mode: 'ease' });
    expect(item!.zoom!.reason).toContain('Checklist');
  });
  it('gráfico longe do rosto fica livre, sem zoom', () => {
    const [item] = planFit({ overlays: [overlay('dica', 'TipCard', 5)], zooms: [] }, FOOT);
    expect(item).toMatchObject({ status: 'livre' });
    expect(item!.zoom).toBeUndefined();
  });
  it('quem já tem palco, cena de tela cheia e camada fixa são ignorados', () => {
    const items = planFit(
      {
        overlays: [
          overlay('a', 'Checklist', 1, { presenter: { slot: 'right', focus: 'auto' } } as Partial<Overlay>),
          overlay('b', 'scene:modelos/X', 10),
          overlay('c', 'Checklist', 20, { layer: 'persistent' } as Partial<Overlay>),
        ],
        zooms: [],
      },
      FOOT,
    );
    expect(items.map((i) => i.status)).toEqual(['ignorado', 'ignorado', 'ignorado']);
  });
  it('zoom da EDL no mesmo trecho vence: avisa em vez de somar', () => {
    const [item] = planFit({ overlays: [overlay('lista', 'Checklist', 20)], zooms: [zoom('z1', 21)] }, FOOT);
    expect(item!.status).toBe('zoom-manual');
    expect(item!.zoom).toBeUndefined();
  });
  it('tela cheia pede palco; componente sem medida avisa', () => {
    const items = planFit({ overlays: [overlay('a', 'Full', 1), overlay('b', 'Desconhecido', 30)], zooms: [] }, FOOT);
    expect(items.map((i) => i.status)).toEqual(['precisa-palco', 'sem-medida']);
  });
  it('dois gráficos colados não geram zooms sobrepostos', () => {
    const items = planFit({ overlays: [overlay('a', 'Checklist', 10), overlay('b', 'Checklist', 12)], zooms: [] }, FOOT);
    expect(items.map((i) => i.status)).toEqual(['ajustado', 'zoom-manual']);
  });
  it('refaz do zero: zoom fit-* antigo não conta como manual', () => {
    const [item] = planFit({ overlays: [overlay('lista', 'Checklist', 20)], zooms: [zoom(`${FIT_PREFIX}lista`, 20)] }, FOOT);
    expect(item!.status).toBe('ajustado');
  });
});

describe('withFit', () => {
  it('troca os fit-* antigos pelos novos e preserva os zooms manuais', () => {
    const base = { overlays: [overlay('lista', 'Checklist', 20)], zooms: [zoom('manual', 50), zoom(`${FIT_PREFIX}velho`, 70)] };
    const out = withFit(base, FOOT);
    expect(out.zooms.map((z) => z.id).sort()).toEqual([`${FIT_PREFIX}lista`, 'manual']);
    expect(base.zooms).toHaveLength(2);
  });
});

describe('zoomStateAt (preview do navegador)', () => {
  const placed = [{ start: 10, end: 14, scale: 1.3, focus: { x: 0.4, y: 0.4 }, mode: 'ease' as const }];
  it('fora do zoom não mexe; no meio chega à escala cheia', async () => {
    const { zoomStateAt } = await import('../src/render/video.ts');
    expect(zoomStateAt(placed, 5).scale).toBe(1);
    expect(zoomStateAt(placed, 12).scale).toBeCloseTo(1.3);
    expect(zoomStateAt(placed, 10).scale).toBeCloseTo(1);
    expect(zoomStateAt(placed, 12).focus).toEqual({ x: 0.4, y: 0.4 });
  });
  it('entra e sai suave (monótono na subida)', async () => {
    const { zoomStateAt } = await import('../src/render/video.ts');
    const s = [10.05, 10.2, 10.35].map((t) => zoomStateAt(placed, t).scale);
    expect(s[0]!).toBeLessThan(s[1]!);
    expect(s[1]!).toBeLessThan(s[2]!);
  });
});
