import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { checkDeliverables, DELIVERABLES, describeDelivery } from '../src/watcher/deliverables.ts';
import { headlessPrompt } from '../src/watcher/headless.ts';
import { jobNotification, sendToQueue } from '../src/watcher/index.ts';
import { enqueue, loadQueue } from '../src/watcher/queue.ts';

const FULL = ['capa-1.png', 'capa-2.png', 'capitulos.txt', 'descricao.txt', 'final.mp4', 'relatorio.md', 'tags.txt', 'titulo.txt'];

describe('pacote de entrega', () => {
  it('só o vídeo é indispensável; o resto vira pendência', () => {
    expect(DELIVERABLES.filter((item) => item.required).map((item) => item.key)).toEqual(['video']);
    expect(DELIVERABLES.map((item) => item.key)).toEqual(['video', 'thumbnail', 'title', 'description', 'chapters', 'report']);
  });

  it('pasta completa: nada falta', () => {
    expect(checkDeliverables(FULL)).toEqual({
      delivered: true,
      present: ['vídeo editado', 'capa', 'título', 'descrição', 'capítulos', 'relatório'],
      missing: [],
    });
  });

  it('só o vídeo: entregue, com a embalagem pendente', () => {
    const check = checkDeliverables(['final.mp4', 'final-shorts.mp4']);
    expect(check.delivered).toBe(true);
    expect(check.missing).toEqual(['capa', 'título', 'descrição', 'capítulos', 'relatório']);
    expect(describeDelivery(check)).toBe('entregue: vídeo editado\nfaltou: capa, título, descrição, capítulos, relatório');
  });

  it('sem final.mp4 não há entrega, mesmo com capa e título', () => {
    const check = checkDeliverables(['capa-1.png', 'titulo.txt']);
    expect(check.delivered).toBe(false);
    expect(check.present).toEqual(['capa', 'título']);
    expect(describeDelivery(checkDeliverables([]))).toBe('entregue: nada\nfaltou: vídeo editado, capa, título, descrição, capítulos, relatório');
  });

  it('capa precisa do nome certo: capa-<n>.png', () => {
    expect(checkDeliverables(['final.mp4', 'capa.png', 'capa-final.png', 'capa-1.jpg']).missing).toContain('capa');
    expect(checkDeliverables(['final.mp4', 'capa-12.png']).missing).not.toContain('capa');
  });

  it('descrição completa não lista pendências', () => {
    expect(describeDelivery(checkDeliverables(FULL))).toBe('entregue: vídeo editado, capa, título, descrição, capítulos, relatório');
  });
});

describe('pedido e aviso do modo autônomo', () => {
  const job = enqueue([], 'D:/gravacoes/aula.mp4', new Date('2026-10-12T03:00:00Z'), 'max').job!;

  it('o pedido cobra o pacote inteiro e manda a embalagem para o packager', () => {
    const prompt = headlessPrompt(job);
    for (const file of ['final.mp4', 'capa-1.png', 'titulo.txt', 'descricao.txt', 'capitulos.txt', 'relatorio.md']) expect(prompt).toContain(file);
    expect(prompt).toContain('sub-agente packager');
    expect(prompt).toContain('máximo de views');
    expect(prompt).toContain('--level max');
  });

  it('a notificação diz o que entrou e o que faltou', () => {
    const done = jobNotification(job, { ok: true, summary: '42 cortes', costUsd: null, turns: 30, present: ['vídeo editado', 'capa'], missing: ['título'] }, 600);
    expect(done.message).toContain('entregue: vídeo editado, capa');
    expect(done.message).toContain('faltou: título');
    expect(done.message).toContain('42 cortes');
    const plain = jobNotification(job, { ok: true, summary: 'ok', costUsd: null, turns: 1 }, 600);
    expect(plain.message).not.toContain('entregue:');
  });
});

describe('sendToQueue', () => {
  it('enfileira um arquivo de qualquer pasta com o nível, uma vez só', () => {
    const queueFile = join(mkdtempSync(join(tmpdir(), 'mce-send-')), 'queue.json');
    const job = sendToQueue('D:/gravacoes/Minha Aula.mp4', 'pro', queueFile, new Date('2026-10-12T03:00:00Z'));
    expect(job).toMatchObject({ slug: 'minha-aula', level: 'pro', status: 'pending' });
    expect(job!.file.replaceAll(String.fromCharCode(92), '/')).toBe('D:/gravacoes/Minha Aula.mp4');
    expect(loadQueue(queueFile)).toHaveLength(1);
    expect(sendToQueue('D:/gravacoes/Minha Aula.mp4', 'pro', queueFile)).toBeNull();
    expect(sendToQueue('D:/gravacoes/notas.txt', null, queueFile)).toBeNull();
    expect(loadQueue(queueFile)).toHaveLength(1);
  });
});
