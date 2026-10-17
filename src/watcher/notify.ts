import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { Config } from '../config.ts';
import { OUTPUT_DIR } from '../project/paths.ts';

export interface Notification {
  title: string;
  message: string;
  ok: boolean;
}

export const NOTIFY_LOG = join(OUTPUT_DIR, 'notificacoes.log');

/** Linha do log local: sempre gravada, com ou sem push. */
export function formatLogLine(notification: Notification, now = new Date()): string {
  return `${now.toISOString()} [${notification.ok ? 'OK' : 'FALHA'}] ${notification.title} — ${notification.message.replace(/\s*\n\s*/g, ' | ')}\n`;
}

/** Requisição para o ntfy (push no celular pelo app ntfy). `null` quando não há tópico configurado. */
export function buildNtfyRequest(config: Config['notify'], notification: Notification): { url: string; init: RequestInit } | null {
  const topic = config.ntfyTopic.trim();
  if (!topic) return null;
  return {
    url: `${config.ntfyServer.replace(/\/+$/, '')}/${encodeURIComponent(topic)}`,
    init: {
      method: 'POST',
      // cabeçalhos HTTP são latin1: o título vai codificado em RFC 2047 para aceitar acento
      headers: {
        Title: `=?UTF-8?B?${Buffer.from(notification.title, 'utf8').toString('base64')}?=`,
        Priority: notification.ok ? 'default' : 'high',
        Tags: notification.ok ? 'clapper' : 'warning',
      },
      body: notification.message,
    },
  };
}

/** Notifica o fim de um job. Falha no push nunca derruba o pipeline: o log local é a garantia. */
export async function notify(config: Config['notify'], notification: Notification, logFile = NOTIFY_LOG): Promise<boolean> {
  mkdirSync(dirname(logFile), { recursive: true });
  appendFileSync(logFile, formatLogLine(notification), 'utf8');
  const request = buildNtfyRequest(config, notification);
  if (!request) return false;
  try {
    const response = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(10_000) });
    return response.ok;
  } catch {
    return false;
  }
}
