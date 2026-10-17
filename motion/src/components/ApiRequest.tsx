import { AbsoluteFill, interpolate } from 'remotion';

import { type BaseProps, progressAt, usePresence } from '../anim';
import { motion, theme } from '../theme';
import { cardSurface } from './c1-kit';
import { clip, CodeTokens, darkTone, eyebrow, monoColumns, monoText } from './c2-kit';
import { fitFontSize, tokenizeLines } from './CodeCard';
import type { ComponentEntry } from './registry';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestProps {
  method: HttpMethod;
  url: string;
  status: number;
  /** corpo enviado (JSON é reidentado; outro texto vai como veio) */
  body?: string;
  /** corpo da resposta */
  response?: string;
  latencyMs?: number;
}

export type StatusTone = 'success' | 'redirect' | 'warning' | 'error' | 'info';

/** Família do status HTTP: 2xx deu certo, 4xx é culpa de quem chamou, 5xx é do servidor. */
export function statusTone(status: number): StatusTone {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500 && status < 600) return 'error';
  return 'info';
}

const toneColor: Record<StatusTone, string> = {
  success: theme.color.emerald,
  redirect: theme.color.glowPeriwinkle,
  warning: darkTone.amber,
  error: darkTone.rose,
  info: theme.color.slate300,
};

export function statusColor(status: number): string {
  return toneColor[statusTone(status)];
}

const REASONS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/** "404 Not Found"; status sem nome conhecido fica só com o número. */
export function statusLabel(status: number): string {
  const reason = REASONS[status];
  return reason ? `${status} ${reason}` : String(status);
}

/** Latência legível: milissegundos até 1s, depois segundos com vírgula decimal. */
export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0).replace('.', ',')} s`;
}

export const MAX_BODY_LINES = 8;

/** Linhas do corpo: JSON válido é reidentado com 2 espaços; o excesso vira uma linha de reticências. */
export function formatBody(text: string | undefined, maxLines = MAX_BODY_LINES): string[] {
  if (!text?.trim()) return [];
  let pretty = text;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // não é JSON: mostra como veio
  }
  const lines = pretty
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\t/g, '  ').trimEnd())
    .filter((line, index, all) => line !== '' || (index > 0 && index < all.length - 1));
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines - 1), '…'];
}

const WIDTH = 1600;
const PAD = 44;
const GAP = 28;
const PANEL_PAD = 30;
const ARROW_START = 0.7;
const ARROW_SEC = 0.6;

interface PanelProps {
  label: string;
  lines: string[];
  width: number;
  frame: number;
  fps: number;
  startSec: number;
}

const Panel: React.FC<PanelProps> = ({ label, lines, width, frame, fps, startSec }) => {
  const inner = width - PANEL_PAD * 2;
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const fontSize = fitFontSize(longest, inner, 30, 22);
  const lineHeight = Math.round(fontSize * 1.55);
  const columns = monoColumns(inner, fontSize);
  const clipped = lines.map((line) => clip(line, columns));
  const tokens = tokenizeLines(clipped, 'json');
  const appear = progressAt(frame, fps, startSec);
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: 14, opacity: appear, translate: `0 ${(1 - appear) * 18}px` }}>
      <div style={eyebrow(20)}>{label}</div>
      <div
        style={{
          flex: 1,
          boxSizing: 'border-box',
          padding: `${PANEL_PAD - 6}px ${PANEL_PAD}px`,
          borderRadius: theme.radius.panel,
          background: theme.color.slate900,
          ...monoText(fontSize, lineHeight),
        }}
      >
        {clipped.map((_, index) => {
          const lineEnter = progressAt(frame, fps, startSec + 0.12 + index * 0.07, 0.3);
          return (
            <div key={index} style={{ height: lineHeight, opacity: lineEnter, translate: `${(1 - lineEnter) * 14}px 0` }}>
              <CodeTokens tokens={tokens[index] ?? []} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ApiRequest: React.FC<ApiRequestProps & BaseProps> = ({ method, url, status, body, response, latencyMs, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);

  const requestLines = formatBody(body);
  const responseLines = formatBody(response);
  const both = requestLines.length > 0 && responseLines.length > 0;
  const inner = WIDTH - PAD * 2;
  const panelWidth = both ? (inner - GAP) / 2 : inner;

  const travel = interpolate(frame, [ARROW_START * fps, (ARROW_START + ARROW_SEC) * fps], [0, 1], {
    easing: motion.move,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const arrived = ARROW_START + ARROW_SEC;
  const pop = interpolate(frame, [arrived * fps, (arrived + motion.base) * fps], [0, 1], {
    easing: motion.pop,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const statusIn = progressAt(frame, fps, arrived, 0.25);
  const head = progressAt(frame, fps, 0.2);
  const latency = latencyMs === undefined ? '' : formatLatency(latencyMs);
  const color = statusColor(status);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          ...cardSurface,
          width: WIDTH,
          boxSizing: 'border-box',
          padding: PAD,
          display: 'flex',
          flexDirection: 'column',
          gap: 34,
          opacity: value,
          translate: `0 ${(1 - enter) * 32 + exit * 16}px`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: 68 }}>
          <div
            style={{
              flexShrink: 0,
              padding: '0 28px',
              height: 60,
              display: 'flex',
              alignItems: 'center',
              borderRadius: theme.radius.pill,
              background: theme.color.slate900,
              fontFamily: theme.font.mono,
              fontWeight: 700,
              fontSize: 30,
              color: theme.color.white,
              opacity: head,
            }}
          >
            {method}
          </div>
          <div
            style={{
              flexShrink: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: theme.font.mono,
              fontWeight: 500,
              fontSize: 32,
              whiteSpace: 'nowrap',
              color: theme.color.ink,
              opacity: head,
              translate: `${(1 - head) * 16}px 0`,
            }}
          >
            {url}
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: 150, height: 28 }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 16,
                top: 12,
                height: 4,
                borderRadius: theme.radius.pill,
                background: theme.color.slate600,
                scale: `${travel} 1`,
                transformOrigin: 'left center',
              }}
            />
            <svg width={22} height={28} viewBox="0 0 22 28" style={{ position: 'absolute', right: 0, top: 0, opacity: statusIn }}>
              <path d="M4 4l12 10L4 24" fill="none" stroke={theme.color.slate600} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* o pacote viaja do pedido até a resposta e some ao chegar */}
            <div
              style={{
                position: 'absolute',
                left: `calc(${travel} * (100% - 34px))`,
                top: 5,
                width: 18,
                height: 18,
                borderRadius: theme.radius.pill,
                background: theme.color.coral,
                opacity: travel > 0 ? 1 - statusIn : 0,
              }}
            />
          </div>
          <div
            style={{
              flexShrink: 0,
              height: 60,
              padding: '0 28px 0 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              borderRadius: theme.radius.pill,
              background: theme.color.slate900,
              fontFamily: theme.font.body,
              fontWeight: 600,
              fontSize: 30,
              whiteSpace: 'nowrap',
              color: theme.color.white,
              opacity: statusIn,
              scale: String(0.8 + 0.2 * pop),
            }}
          >
            <div style={{ width: 18, height: 18, borderRadius: theme.radius.pill, background: color }} />
            {statusLabel(status)}
          </div>
          {latency ? (
            <div
              style={{
                flexShrink: 0,
                fontFamily: theme.font.body,
                fontWeight: 600,
                fontSize: 28,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                color: theme.color.slate600,
                opacity: progressAt(frame, fps, arrived + 0.15),
              }}
            >
              {latency}
            </div>
          ) : null}
        </div>
        {requestLines.length || responseLines.length ? (
          <div style={{ display: 'flex', alignItems: 'stretch', gap: GAP }}>
            {requestLines.length ? <Panel label="Corpo enviado" lines={requestLines} width={panelWidth} frame={frame} fps={fps} startSec={0.35} /> : null}
            {responseLines.length ? <Panel label="Resposta" lines={responseLines} width={panelWidth} frame={frame} fps={fps} startSec={arrived + 0.1} /> : null}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const sample: ApiRequestProps = {
  method: 'POST',
  url: '/api/tarefas',
  status: 201,
  latencyMs: 142,
  body: '{"titulo":"Gravar vídeo de TypeScript","feita":false}',
  response: '{"id":87,"titulo":"Gravar vídeo de TypeScript","feita":false,"criadaEm":"2026-10-12T14:03:00Z"}',
};

export const entry: ComponentEntry = {
  component: ApiRequest,
  sample: { ...sample },
  defaultDuration: 8,
  vertical: { zone: 'full' },
  description: 'Requisição HTTP indo e a resposta voltando, com método, status colorido e JSON; use quando a fala explica uma chamada de API ou um código de status.',
};
