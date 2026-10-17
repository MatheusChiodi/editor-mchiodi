import { AbsoluteFill, Series } from 'remotion';

import type { ComponentEntry } from '../components/registry';
import { theme } from '../theme';

export interface ReelPart {
  key: string;
  /** nome da cena, sem o projeto */
  name: string;
  durationInFrames: number;
}

/** Cenas do roteiro com a duração sugerida de cada uma; chave sem registro (índice desatualizado) fica de fora. */
export function reelParts(keys: string[], entries: Record<string, Pick<ComponentEntry, 'defaultDuration'> | undefined>, fps: number): ReelPart[] {
  return keys.flatMap((key) => {
    const entry = entries[key];
    return entry ? [{ key, name: key.slice(key.indexOf('/') + 1), durationInFrames: Math.max(1, Math.round(entry.defaultDuration * fps)) }] : [];
  });
}

export function reelDuration(parts: ReelPart[]): number {
  return Math.max(1, parts.reduce((total, part) => total + part.durationInFrames, 0));
}

/** Todas as cenas de um projeto em sequência, com o nome de cada uma no canto: é ver o conjunto de uma vez no Studio. */
export const SceneReel: React.FC<{ parts: ReelPart[]; registry: Record<string, ComponentEntry> }> = ({ parts, registry }) => (
  <AbsoluteFill style={{ background: theme.color.paper }}>
    <Series>
      {parts.map((part, index) => {
        const entry = registry[part.key]!;
        const Component = entry.component;
        return (
          <Series.Sequence key={part.key} durationInFrames={part.durationInFrames} name={part.name}>
            <Component {...entry.sample} durationInFrames={part.durationInFrames} />
            <div
              style={{
                position: 'absolute',
                top: 28,
                right: 36,
                padding: '8px 18px',
                borderRadius: theme.radius.pill,
                background: 'rgba(15,23,42,0.72)',
                color: theme.color.white,
                fontFamily: theme.font.body,
                fontWeight: 600,
                fontSize: 24,
                letterSpacing: '0.02em',
              }}
            >
              {index + 1}/{parts.length} · {part.name}
            </div>
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);
