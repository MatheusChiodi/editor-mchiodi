import { AbsoluteFill } from 'remotion';

import { type BaseProps, progressAt, stagger, usePresence } from '../anim';
import { theme } from '../theme';
import { clip, fitWire, Icon, WireBlock, type WireBlockSpec } from './c2-kit';
import type { ComponentEntry } from './registry';
import { withAlpha } from './SectionTitle';

export interface BrowserBlock {
  kind: 'heading' | 'text' | 'button' | 'image' | 'input';
  label?: string;
}

export interface BrowserFrameProps {
  url: string;
  /** título da aba */
  title?: string;
  children?: never;
  /** wireframe da página, de cima para baixo (máx. 6 blocos) */
  blocks?: BrowserBlock[];
}

export interface UrlParts {
  secure: boolean;
  host: string;
  /** caminho + query, começando em `/` (vazio na raiz) */
  path: string;
}

/** Separa a URL em host e caminho; o protocolo vira só o cadeado, como na barra de um navegador real. */
export function splitUrl(url: string): UrlParts {
  const trimmed = url.trim();
  const match = /^([a-z][a-z\d+.-]*):\/\/(.*)$/i.exec(trimmed);
  const secure = match ? match[1]!.toLowerCase() === 'https' : !/^localhost|^127\./.test(trimmed);
  const rest = match ? match[2]! : trimmed;
  const slash = rest.search(/[/?#]/);
  const host = slash < 0 ? rest : rest.slice(0, slash);
  const path = slash < 0 ? '' : rest.slice(slash);
  return { secure, host, path: path === '/' ? '' : path };
}

export const URL_START_SEC = 0.4;
const URL_CHARS_PER_SEC = 42;
const URL_MAX_SEC = 0.9;

/** Caracteres do endereço já digitados no instante `sec` (a digitação nunca passa de 0.9s). */
export function typedUrlChars(length: number, sec: number): number {
  if (length <= 0 || sec < URL_START_SEC) return 0;
  const typingSec = Math.min(URL_MAX_SEC, length / URL_CHARS_PER_SEC);
  return Math.min(length, Math.floor(((sec - URL_START_SEC) / typingSec) * length));
}

/** Segundo em que a página começa a "carregar": logo depois do endereço digitado. */
export function pageStart(urlLength: number): number {
  return URL_START_SEC + Math.min(URL_MAX_SEC, urlLength / URL_CHARS_PER_SEC) + 0.15;
}

export const DEFAULT_BROWSER_BLOCKS: BrowserBlock[] = [{ kind: 'heading' }, { kind: 'text' }, { kind: 'image' }, { kind: 'button' }];

const WIDTH = 1320;
const HEIGHT = 800;
const BAR = 88;
const TAB = 60;
const PAD_X = 64;
const PAD_Y = 48;
const MAX_URL_CHARS = 58;

export const BrowserFrame: React.FC<BrowserFrameProps & BaseProps> = ({ url, title, blocks, durationInFrames }) => {
  const { frame, fps, enter, exit, value } = usePresence(durationInFrames);
  const sec = frame / fps;

  const parts = splitUrl(url);
  const address = clip(parts.host + parts.path, MAX_URL_CHARS);
  const typed = typedUrlChars(address.length, sec);
  const host = address.slice(0, Math.min(typed, parts.host.length));
  const path = typed > parts.host.length ? address.slice(parts.host.length, typed) : '';
  const start = pageStart(address.length);
  const loading = progressAt(frame, fps, start - 0.15, 0.5);

  const chrome = BAR + (title ? TAB : 0);
  const source: WireBlockSpec[] = blocks?.length ? blocks : DEFAULT_BROWSER_BLOCKS;
  const layout = fitWire(source, HEIGHT - chrome - PAD_Y * 2);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: theme.radius.card,
          background: theme.color.paper,
          boxShadow: `${theme.shadow.raised}, 0 0 0 1px ${withAlpha(theme.color.white, 0.7)}`,
          opacity: value,
          translate: `0 ${(1 - enter) * 32 + exit * 16}px`,
          scale: String(0.97 + 0.03 * value),
        }}
      >
        <div style={{ flexShrink: 0, background: withAlpha(theme.color.slate300, 0.55) }}>
          {title ? (
            <div style={{ height: TAB, display: 'flex', alignItems: 'flex-end', padding: '0 28px' }}>
              <div
                style={{
                  maxWidth: 520,
                  height: TAB - 12,
                  padding: '0 28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  borderRadius: `${theme.radius.panel}px ${theme.radius.panel}px 0 0`,
                  background: theme.color.paper,
                  fontFamily: theme.font.body,
                  fontWeight: 600,
                  fontSize: 24,
                  color: theme.color.slate600,
                }}
              >
                <div style={{ flexShrink: 0, width: 12, height: 12, borderRadius: theme.radius.pill, background: theme.color.coral }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
              </div>
            </div>
          ) : null}
          <div style={{ height: BAR, display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', background: theme.color.paper }}>
            {[0, 1, 2].map((dot) => (
              <div key={dot} style={{ flexShrink: 0, width: 16, height: 16, borderRadius: theme.radius.pill, background: theme.color.slate300 }} />
            ))}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: 56,
                marginLeft: 20,
                padding: '0 26px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                borderRadius: theme.radius.pill,
                background: theme.color.white,
                border: `1px solid ${theme.color.slate300}`,
                fontFamily: theme.font.body,
                fontSize: 28,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {parts.secure ? <Icon name="lock" size={24} color={theme.color.slate600} strokeWidth={2} /> : null}
              <span>
                <span style={{ fontWeight: 600, color: theme.color.ink }}>{host}</span>
                <span style={{ fontWeight: 500, color: theme.color.slate600 }}>{path}</span>
              </span>
              {typed < address.length ? <span style={{ width: 3, height: 30, marginLeft: -10, background: theme.color.ink }} /> : null}
            </div>
          </div>
          {/* barra de carregamento: a única dose de coral da tela */}
          <div style={{ height: 4, background: theme.color.paper }}>
            <div
              style={{
                height: 4,
                background: theme.color.coral,
                scale: `${loading} 1`,
                transformOrigin: 'left center',
                opacity: loading >= 1 ? 1 - progressAt(frame, fps, start + 0.35, 0.3) : loading > 0 ? 1 : 0,
              }}
            />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 26 * layout.scale, padding: `${PAD_Y}px ${PAD_X}px` }}>
          {layout.blocks.map((block, index) => (
            <WireBlock
              key={index}
              block={block}
              height={layout.heights[index]!}
              scale={Math.max(0.8, layout.scale)}
              appear={progressAt(frame, fps, stagger(index, 0.14, start))}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const sample: BrowserFrameProps = {
  url: 'https://mchiodi.com/projetos',
  title: 'Projetos — MChiodi',
  blocks: [
    { kind: 'heading', label: 'Projetos em destaque' },
    { kind: 'text', label: 'Sistemas que eu construí e mantenho no ar, do backend em Java ao front em React.' },
    { kind: 'image', label: 'captura do projeto' },
    { kind: 'button', label: 'Ver projeto' },
  ],
};

export const entry: ComponentEntry = {
  component: BrowserFrame,
  sample: { ...sample },
  defaultDuration: 7,
  description: 'Janela de navegador com a URL digitada e um wireframe da página; use para falar de um site, rota ou tela web sem depender de gravação de tela.',
};
