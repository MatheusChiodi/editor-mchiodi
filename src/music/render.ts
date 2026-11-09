import { join } from 'node:path';
import { renderMedia, selectComposition } from '@remotion/renderer';

import type { MusicPlan } from '../../motion/src/music/types.ts';
import { ffmpeg, type ProgressFn } from '../lib/ffmpeg.ts';
import { bundleMotion, CHROMIUM_OPTIONS } from '../render/overlay.ts';

export interface RenderMusicOptions {
  /** pasta de trabalho (guarda o vídeo sem áudio) */
  workDir: string;
  /** 0.5 = metade da resolução; precisa dar dimensões inteiras (1 ou 0.5) */
  scale?: number;
  concurrency?: number;
  onProgress?: ProgressFn;
}

/**
 * Renderiza a composição `MusicVideo` sem áudio e junta a música original (cópia do vídeo, AAC 192k).
 * O áudio nunca passa pelo Remotion: sai exatamente como entrou.
 */
export async function renderMusicVideo(plan: MusicPlan, audioPath: string, output: string, options: RenderMusicOptions): Promise<void> {
  const { workDir, scale = 1, concurrency = 4, onProgress } = options;
  const serveUrl = await bundleMotion();
  const inputProps = { plan } as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: 'MusicVideo', inputProps, chromiumOptions: CHROMIUM_OPTIONS });
  const silent = join(workDir, 'music.silent.mp4');
  const startedAt = Date.now();
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: 'h264',
    crf: 18,
    scale,
    concurrency,
    muted: true,
    chromiumOptions: CHROMIUM_OPTIONS,
    outputLocation: silent,
    onProgress: ({ progress }) => {
      const elapsed = (Date.now() - startedAt) / 1000;
      onProgress?.({ label: 'vídeo da música (Remotion)', percent: progress * 100, etaSec: progress > 0.02 ? (elapsed / progress) * (1 - progress) : null });
    },
  });
  await ffmpeg(['-i', silent, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', output], {
    label: 'juntando a música',
    durationSec: plan.durationInFrames / plan.fps,
    onProgress,
  });
}
