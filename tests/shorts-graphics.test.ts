import { describe, expect, it } from 'vitest';

import { CAPTION_PRESETS } from '../motion/src/captions/presets.ts';
import { registry } from '../motion/src/components/registry.ts';
import {
  captionBand,
  collisions,
  DEFAULT_FACE_BAND,
  designSize,
  placeVertical,
  resolveVertical,
  VERTICAL_ZONES,
  verticalFrame,
  zoneRect,
} from '../motion/src/vertical.ts';
import type { Transcript } from '../src/analyze/types.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline, sourceToOutput } from '../src/edl/timeline.ts';
import { buildOverlayProps } from '../src/render/overlay.ts';
import { formatShortsPick, pickShortsOverlays, shortsEdl, shortsFrame } from '../src/render/shorts.ts';

const transcript = { language: 'pt', words: [] } as unknown as Transcript;
const frame = verticalFrame({ width: 1080, height: 1920, captions: 'padrao' });

function edlWith(extra: Record<string, unknown>) {
  return edlSchema.parse({
    version: 1,
    project: 'teste',
    createdAt: '2026-10-17T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 60, fps: 30, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    // corte em 10–12: o Short (5–15) tem dois clipes
    clips: [
      { id: 'c1', start: 0, end: 10 },
      { id: 'c2', start: 12, end: 40 },
    ],
    shorts: { start: 5, end: 15 },
    ...extra,
  });
}

const overlay = (id: string, at: number, extra: Record<string, unknown> = {}) => ({ id, component: 'TipCard', at, duration: 2, props: { text: id }, ...extra });

describe('diagramação vertical: faixas', () => {
  it('a faixa da legenda acompanha o estilo: 2 linhas do padrão, 1 linha do minimal', () => {
    const padrao = captionBand('padrao', 1920);
    // página ancorada a 420 px do fundo, 2 linhas de 84 px (1,18), contorno 12 e a palavra ativa 5% maior
    expect(padrao.bottom).toBeGreaterThanOrEqual(1500);
    expect(padrao.top).toBeLessThanOrEqual(1500 - 2 * 84 * 1.18);
    expect(padrao.top).toBeGreaterThan(1240);
    const minimal = captionBand('minimal', 1920);
    expect(minimal.top).toBeGreaterThan(padrao.top);
    expect(captionBand('bold-shorts', 1920).top).toBeLessThan(padrao.top);
  });

  it('o rosto padrão é o terço do meio do recorte de altura inteira; a EDL pode trocar', () => {
    expect(frame.face).toEqual({ top: Math.round(DEFAULT_FACE_BAND.top * 1920), bottom: Math.round(DEFAULT_FACE_BAND.bottom * 1920) });
    expect(verticalFrame({ width: 1080, height: 1920, captions: null, faceBand: { top: 0.1, bottom: 0.3 } }).face).toEqual({ top: 192, bottom: 576 });
  });

  it('sem legenda, a área útil para antes da interface de baixo do app', () => {
    const silent = verticalFrame({ width: 1080, height: 1920, captions: null });
    expect(zoneRect('full', silent)!.y + zoneRect('full', silent)!.height).toBeLessThan(1920 * 0.84);
  });
});

describe('diagramação vertical: caixas', () => {
  it('top fica entre a interface de cima e o rosto, na largura útil', () => {
    const box = placeVertical({ zone: 'top' }, frame)!;
    expect(box).toMatchObject({ zone: 'top', x: 60, y: 140, width: 960, scale: 0.9 });
    expect(box.y + box.height).toBe(frame.face.top - frame.gap);
    expect(collisions(box, frame)).toEqual([]);
  });

  it('nenhuma zona, em nenhum estilo de legenda, cobre a legenda; só o inserto cobre o rosto', () => {
    for (const preset of CAPTION_PRESETS) {
      const each = verticalFrame({ width: 1080, height: 1920, captions: preset });
      for (const zone of VERTICAL_ZONES) {
        const box = placeVertical({ zone }, each);
        if (!box) {
          expect(zone).toBe('skip');
          continue;
        }
        const hits = collisions(box, each);
        expect(hits, `${preset}/${zone}`).not.toContain('captions');
        if (box.zone === 'top' || box.zone === 'bottom') expect(hits, `${preset}/${zone}`).toEqual([]);
      }
    }
  });

  it('bottom sem altura útil (rosto colado na legenda) cai para top; com o rosto alto, fica entre rosto e legenda', () => {
    expect(placeVertical({ zone: 'bottom' }, frame)!.zone).toBe('top');
    const high = verticalFrame({ width: 1080, height: 1920, captions: 'padrao', faceBand: { top: 0.08, bottom: 0.32 } });
    const box = placeVertical({ zone: 'bottom' }, high)!;
    expect(box.zone).toBe('bottom');
    expect(box.y).toBe(high.face.bottom + high.gap);
    expect(box.y + box.height).toBe(high.captions!.top - high.gap);
  });

  it('top sem altura útil (rosto no alto) cai para o inserto', () => {
    const high = verticalFrame({ width: 1080, height: 1920, captions: 'padrao', faceBand: { top: 0.1, bottom: 0.4 } });
    expect(placeVertical({ zone: 'top' }, high)!.zone).toBe('full');
  });

  it('full vai do topo útil até a legenda; frame é o quadro inteiro; skip não entra', () => {
    const full = placeVertical({ zone: 'full' }, frame)!;
    expect(full.y).toBe(140);
    expect(full.y + full.height).toBe(frame.captions!.top - frame.gap);
    expect(full.scale).toBe(0.7);
    expect(placeVertical({ zone: 'frame' }, frame)).toMatchObject({ x: 0, y: 0, width: 1080, height: 1920, scale: 1 });
    expect(placeVertical({ zone: 'skip' }, frame)).toBeNull();
  });

  it('a escala pedida vale dentro dos limites e define o tamanho de projeto que o componente enxerga', () => {
    expect(placeVertical({ zone: 'top', scale: 5 }, frame)!.scale).toBe(1.5);
    expect(placeVertical({ zone: 'top', scale: 0.1 }, frame)!.scale).toBe(0.3);
    const box = placeVertical({ zone: 'full', scale: 0.5 }, frame)!;
    expect(designSize(box)).toEqual({ width: 1920, height: Math.round(box.height / 0.5) });
  });

  it('override da EDL vence o componente, que vence o padrão (cena sob medida = inserto)', () => {
    expect(resolveVertical('TipCard', { zone: 'top' }, { zone: 'full' })).toEqual({ zone: 'full' });
    expect(resolveVertical('TipCard', { zone: 'bottom' }, undefined)).toEqual({ zone: 'bottom' });
    expect(resolveVertical('TipCard', undefined, undefined)).toEqual({ zone: 'top' });
    expect(resolveVertical('scene:x/Cena', undefined, undefined)).toEqual({ zone: 'full' });
  });

  it('todo componente da biblioteca declara a diagramação vertical; os largos e de CTA ficam de fora', () => {
    for (const [name, entry] of Object.entries(registry)) expect(entry.vertical, name).toBeDefined();
    for (const name of ['LowerThird', 'SubscribeCTA', 'LikeReminder', 'WindowStage', 'StageProgress']) expect(registry[name]!.vertical!.zone, name).toBe('skip');
    expect(registry.Stinger!.vertical!.zone).toBe('frame');
    expect(registry.Fx!.vertical!.zone).toBe('frame');
    expect(registry.CodeCard!.vertical!.zone).toBe('full');
    expect(registry.SectionTitle!.vertical!.zone).toBe('top');
  });
});

describe('Short: quais overlays entram e quando', () => {
  const shortTimeline = (edl: ReturnType<typeof edlWith>) => buildTimeline(shortsEdl(edl).clips, 30);

  it('entra só o que está ancorado num clipe do trecho; antes ou depois dele fica fora', () => {
    const edl = edlWith({ overlays: [overlay('antes', 4), overlay('dentro', 6), overlay('depois-do-corte', 13), overlay('fim', 15.5)] });
    const pick = pickShortsOverlays(edl, shortTimeline(edl));
    expect(pick.kept.map((item) => item.id)).toEqual(['dentro', 'depois-do-corte']);
    expect(pick.skipped).toEqual([
      { id: 'antes', reason: 'fora-do-trecho' },
      { id: 'fim', reason: 'fora-do-trecho' },
    ]);
  });

  it('`shorts: false`, `graphics: "none"`, palco e camada fixa ficam fora, cada um com o motivo', () => {
    const edl = edlWith({
      overlays: [
        overlay('off', 6, { shorts: false }),
        overlay('palco', 7, { presenter: { slot: 'right' } }),
        overlay('janela', 7.5, { component: 'WindowStage', props: { kind: 'footage' } }),
        overlay('fixa', 8, { component: 'StageProgress', layer: 'persistent' }),
        overlay('ok', 9),
      ],
    });
    const pick = pickShortsOverlays(edl, shortTimeline(edl));
    expect(pick.kept.map((item) => item.id)).toEqual(['ok']);
    expect(Object.fromEntries(pick.skipped.map((item) => [item.id, item.reason]))).toEqual({ off: 'desligado', palco: 'palco', janela: 'palco', fixa: 'camada-fixa' });
    expect(formatShortsPick(pick)).toBe('gráficos no Short: ok · fora: off (desligado na EDL), palco (palco 16:9), janela (palco 16:9), fixa (camada fixa)');

    const none = edlWith({ overlays: [overlay('a', 6)], shorts: { start: 5, end: 15, graphics: 'none' } });
    expect(pickShortsOverlays(none, shortTimeline(none))).toEqual({ kept: [], skipped: [{ id: 'a', reason: 'desligado' }] });
  });

  it('âncora meio frame antes do início quantizado do clipe encosta no início em vez de sumir', () => {
    // 5.016 s a 30 fps arredonda para o frame 150 (5.0 s)… e 5.017 para 151 (5.0333 s): a âncora em 5.017 ficaria fora
    const edl = edlWith({ overlays: [overlay('borda', 5.017)], shorts: { start: 5.017, end: 9 } });
    const timeline = shortTimeline(edl);
    expect(timeline.clips[0]!.sourceStart).toBeGreaterThan(5.017);
    const pick = pickShortsOverlays(edl, timeline);
    expect(pick.kept).toHaveLength(1);
    expect(pick.kept[0]!.at).toBe(timeline.clips[0]!.sourceStart);
  });

  it('no vertical a legenda nunca se esconde (nenhuma caixa cobre a faixa dela)', () => {
    const edl = edlWith({ overlays: [overlay('a', 6, { hidesCaptions: true })] });
    expect(shortsEdl(edl).overlays[0]!.hidesCaptions).toBe(false);
  });

  it('os tempos vão para o tempo de saída do Short pela timeline (o corte de 10–12 não conta)', () => {
    const edl = edlWith({ overlays: [overlay('a', 6), overlay('b', 13, { shorts: { zone: 'full', scale: 0.8 } })] });
    const short = shortsEdl(edl);
    const timeline = buildTimeline(short.clips, 30);
    const props = buildOverlayProps(short, timeline, transcript, shortsFrame(short));
    expect(props).toMatchObject({ width: 1080, height: 1920, vertical: { width: 1080, height: 1920 } });
    const [a, b] = props.overlays;
    expect(a).toMatchObject({ id: 'a', from: Math.round(sourceToOutput(timeline, 6)! * 30) });
    expect(a!.from).toBe(30);
    // 5–10 (5 s) + 12–13 (1 s) = 6 s de saída
    expect(b).toMatchObject({ id: 'b', from: 180, vertical: { zone: 'full', scale: 0.8 } });
    expect(a!.vertical).toBeUndefined();
  });

  it('o vídeo longo não muda: sem quadro vertical, o item não leva zona nem as props levam `vertical`', () => {
    const edl = edlWith({ overlays: [overlay('a', 6, { shorts: { zone: 'full' } })] });
    const props = buildOverlayProps(edl, buildTimeline(edl.clips, 30), transcript);
    expect(props.vertical).toBeUndefined();
    expect(props.overlays[0]!.vertical).toBeUndefined();
  });

  it('o quadro do Short segue o estilo da legenda e a faixa do rosto da EDL', () => {
    const edl = edlWith({ captions: { preset: 'bold-shorts' }, shorts: { start: 5, end: 15, faceBand: { top: 0.2, bottom: 0.5 } } });
    const short = shortsFrame(shortsEdl(edl));
    expect(short.captions).toEqual(captionBand('bold-shorts', 1920));
    expect(short.face).toEqual({ top: 384, bottom: 960 });
  });
});

describe('EDL: gráficos no Short (retrocompatível)', () => {
  it('EDL antiga continua válida: graphics padrão `auto`, sem faceBand, overlay sem `shorts`', () => {
    const edl = edlWith({ overlays: [overlay('a', 6)] });
    expect(edl.shorts).toMatchObject({ graphics: 'auto' });
    expect(edl.shorts!.faceBand).toBeUndefined();
    expect(edl.overlays[0]!.shorts).toBeUndefined();
  });

  it('recusa zona desconhecida, escala fora da faixa e faixa do rosto invertida', () => {
    expect(() => edlWith({ overlays: [overlay('a', 6, { shorts: { zone: 'meio' } })] })).toThrow();
    expect(() => edlWith({ overlays: [overlay('a', 6, { shorts: { zone: 'top', scale: 3 } })] })).toThrow();
    expect(() => edlWith({ overlays: [overlay('a', 6, { shorts: true })] })).toThrow();
    expect(() => edlWith({ shorts: { start: 5, end: 15, faceBand: { top: 0.6, bottom: 0.3 } } })).toThrow(/faceBand/);
    expect(() => edlWith({ shorts: { start: 5, end: 15, graphics: 'todos' } })).toThrow();
  });
});
