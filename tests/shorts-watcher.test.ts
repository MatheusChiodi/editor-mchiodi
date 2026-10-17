import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { configSchema } from '../src/config.ts';
import { edlSchema } from '../src/edl/schema.ts';
import { buildTimeline } from '../src/edl/timeline.ts';
import { shiftTimes } from '../src/eval/index.ts';
import { outputNames, renderDir } from '../src/render/index.ts';
import { clipsWithin, SHORTS_SIZE, shortsEdl, verticalCrop } from '../src/render/shorts.ts';
import type { ProjectPaths } from '../src/project/paths.ts';
import { buildNtfyRequest, formatLogLine, notify } from '../src/watcher/notify.ts';
import {
  enqueue,
  isCompanionFile,
  isVideoFile,
  type Job,
  loadQueue,
  nextJob,
  recoverInterrupted,
  saveQueue,
  summarize,
  updateJob,
} from '../src/watcher/queue.ts';

const dir = mkdtempSync(join(tmpdir(), 'mce-watch-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function edlWith(extra: Record<string, unknown>) {
  return edlSchema.parse({
    version: 4,
    project: 'teste',
    createdAt: '2026-10-12T00:00:00.000Z',
    source: { path: 'C:/v.mp4', durationSec: 300, fps: 60, width: 1920, height: 1080 },
    output: { fps: 30, width: 1920, height: 1080 },
    clips: [
      { id: 'c1', start: 0, end: 50 },
      { id: 'c2', start: 60, end: 120 },
      { id: 'c3', start: 130, end: 290 },
    ],
    ...extra,
  });
}

describe('shorts', () => {
  it('clipsWithin recorta os clipes ao trecho escolhido', () => {
    const edl = edlWith({});
    expect(clipsWithin(edl.clips, 40, 80)).toEqual([
      { id: 'c1', start: 40, end: 50 },
      { id: 'c2', start: 60, end: 80 },
    ]);
    expect(clipsWithin(edl.clips, 50, 60)).toEqual([]);
  });

  it('verticalCrop gera um recorte 9:16 em volta do foco, no tamanho pedido', () => {
    expect(verticalCrop(0.5)).toContain("x='(iw-ow)*0.500'");
    expect(verticalCrop(0.5)).toContain('scale=1080:1920');
    expect(verticalCrop(7, { width: 540, height: 960 })).toContain("x='(iw-ow)*1.000'");
    expect(verticalCrop(0.2, { width: 540, height: 960 })).toContain('scale=540:960');
  });

  it('shortsEdl deriva uma EDL vertical só com o trecho e os overlays ancorados nele', () => {
    const edl = edlWith({
      shorts: { start: 40, end: 80, focusX: 0.45, reason: 'melhor explicação' },
      overlays: [{ id: 'o1', component: 'LowerThird', at: 45, duration: 3, reason: 'nome' }],
      zooms: [
        { id: 'z1', at: 45, duration: 2, reason: 'ênfase' },
        { id: 'z2', at: 200, duration: 2, reason: 'ênfase' },
      ],
      transitions: [
        { id: 't1', intoClip: 'c2', type: 'wipe' },
        { id: 't2', intoClip: 'c3', type: 'wipe' },
      ],
      chapters: [{ title: 'A', at: 1 }, { title: 'B', at: 70 }, { title: 'C', at: 200 }],
    });
    const short = shortsEdl(edl);
    expect(short.output).toEqual({ fps: 30, ...SHORTS_SIZE });
    expect(short.clips.map((clip) => [clip.id, clip.start, clip.end])).toEqual([['c1', 40, 50], ['c2', 60, 80]]);
    expect(short.captions).toMatchObject({ enabled: true, style: 'shorts', maxWordsPerPage: 3 });
    // a zona vertical (LowerThird = skip) é decidida na camada de gráficos; aqui só a seleção por trecho
    expect(short.overlays.map((item) => item.id)).toEqual(['o1']);
    expect(shortsEdl({ ...edl, shorts: { ...edl.shorts!, graphics: 'none' } }).overlays).toEqual([]);
    expect(short.zooms.map((zoom) => zoom.id)).toEqual(['z1']);
    expect(short.transitions.map((transition) => transition.id)).toEqual(['t1']);
    expect(short.chapters).toEqual([]);
    expect(buildTimeline(short.clips, 30).durationSec).toBe(30);
    // a EDL derivada continua válida no schema
    expect(edlSchema.safeParse(short).success).toBe(true);
  });

  it('shortsEdl exige o trecho definido e com conteúdo', () => {
    expect(() => shortsEdl(edlWith({}))).toThrow(/shorts/);
    expect(() => shortsEdl(edlWith({ shorts: { start: 50.5, end: 59 } }))).toThrow(/nenhum clipe/);
  });

  it('nomes de pasta e de arquivo distinguem o Short do vídeo principal', () => {
    const paths = { rendersDir: 'r' } as ProjectPaths;
    const edl = edlWith({});
    expect(renderDir(paths, edl, 'preview').replace(/\\/g, '/')).toBe('r/v4-preview');
    expect(renderDir(paths, edl, 'final', 'shorts').replace(/\\/g, '/')).toBe('r/v4-shorts-final');
    expect(outputNames('final', 'main')).toEqual({ file: 'final.mp4', delivered: 'final.mp4' });
    expect(outputNames('final', 'shorts')).toEqual({ file: 'shorts-final.mp4', delivered: 'final-shorts.mp4' });
    expect(outputNames('preview', 'shorts').delivered).toBeNull();
  });

  it('shiftTimes desloca pelos segundos da abertura', () => {
    expect(shiftTimes([1, 2], 0)).toEqual([1, 2]);
    expect(shiftTimes([1, 2], 2.5)).toEqual([3.5, 4.5]);
  });
});

describe('fila do watcher', () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 12, 3, minute));

  it('reconhece vídeo e ignora gravação de tela acompanhante', () => {
    expect(isVideoFile('D:/inbox/Aula.MP4')).toBe(true);
    expect(isVideoFile('D:/inbox/notas.txt')).toBe(false);
    expect(isCompanionFile('D:/inbox/aula.tela.mp4')).toBe(true);
    expect(isCompanionFile('D:/inbox/aula.mp4')).toBe(false);
  });

  it('enfileira uma vez só e processa um por vez, em ordem de chegada', () => {
    let queue: Job[] = [];
    ({ queue } = enqueue(queue, 'D:/inbox/a.mp4', at(0)));
    ({ queue } = enqueue(queue, 'D:/inbox/b.mp4', at(1)));
    expect(enqueue(queue, 'D:/inbox/a.mp4', at(2)).job).toBeNull();
    expect(enqueue(queue, 'D:/inbox/a.tela.mp4', at(2)).job).toBeNull();
    expect(enqueue(queue, 'D:/inbox/leia.txt', at(2)).job).toBeNull();
    expect(queue.map((job) => job.slug)).toEqual(['a', 'b']);

    const first = nextJob(queue)!;
    expect(first.slug).toBe('a');
    queue = updateJob(queue, first.id, { status: 'running', startedAt: at(3).toISOString(), attempts: 1 });
    expect(nextJob(queue)).toBeNull();
    queue = updateJob(queue, first.id, { status: 'done', finishedAt: at(9).toISOString() });
    expect(nextJob(queue)!.slug).toBe('b');
    expect(summarize(queue)).toBe('1 na fila · 0 rodando · 1 concluídos · 0 com falha');
  });

  it('arquivo que falhou pode voltar para a fila; job interrompido é recuperado', () => {
    let queue: Job[] = [];
    ({ queue } = enqueue(queue, 'D:/inbox/a.mp4', at(0)));
    queue = updateJob(queue, queue[0]!.id, { status: 'failed', error: 'x' });
    const retry = enqueue(queue, 'D:/inbox/a.mp4', at(5));
    expect(retry.job).not.toBeNull();
    expect(retry.queue).toHaveLength(1);

    const running = updateJob(retry.queue, retry.job!.id, { status: 'running', startedAt: at(6).toISOString() });
    expect(recoverInterrupted(running)[0]).toMatchObject({ status: 'pending', startedAt: null });
  });

  it('persiste em disco', () => {
    const file = join(dir, 'q', 'queue.json');
    expect(loadQueue(file)).toEqual([]);
    const { queue } = enqueue([], 'D:/inbox/a.mp4', at(0));
    saveQueue(queue, file);
    expect(loadQueue(file)).toEqual(queue);
  });
});

describe('notificação', () => {
  const config = configSchema.parse({}).notify;
  const done = { title: 'Vídeo pronto: aula', message: 'final.mp4 · 07:23\nrelatorio.md', ok: true };

  it('sem tópico não monta requisição; com tópico monta POST para o ntfy', () => {
    expect(buildNtfyRequest(config, done)).toBeNull();
    const request = buildNtfyRequest({ ...config, ntfyTopic: 'mchiodi editor', ntfyServer: 'https://ntfy.sh/' }, done)!;
    expect(request.url).toBe('https://ntfy.sh/mchiodi%20editor');
    expect(request.init.method).toBe('POST');
    expect(request.init.body).toBe(done.message);
    const headers = request.init.headers as Record<string, string>;
    expect(headers.Priority).toBe('default');
    expect(Buffer.from(headers.Title!.slice(10, -2), 'base64').toString('utf8')).toBe(done.title);
    expect((buildNtfyRequest({ ...config, ntfyTopic: 't' }, { ...done, ok: false })!.init.headers as Record<string, string>).Priority).toBe('high');
  });

  it('sempre grava o log local, numa linha só', async () => {
    const log = join(dir, 'n', 'notificacoes.log');
    expect(await notify(config, done, log)).toBe(false);
    const line = readFileSync(log, 'utf8');
    expect(line).toBe(formatLogLine(done, new Date(line.slice(0, 24))));
    expect(line).toContain('[OK] Vídeo pronto: aula — final.mp4 · 07:23 | relatorio.md');
    expect(line.endsWith('\n')).toBe(true);
  });
});
