import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { makeCancelSignal, openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';

import { ASSETS_DIR, MOTION_ENTRY } from '../project/paths.ts';
import { CHROMIUM_OPTIONS } from '../render/overlay.ts';
import { stripFrames } from './meta.ts';
import { overallPercent } from './queue.ts';
import { PreviewBundleError, type PreviewRenderer, type RenderHooks, type RenderJob, type RenderResult, type StripFrame } from './types.ts';

export const STRIP_WIDTH = 640;
/** 1920×1080 × 0.45 = 864×486 (≈480p, lados pares para o h264) */
export const VIDEO_SCALE = 0.45;
/** 2 abas do Chrome: mais que isso disputa RAM com o resto da edição */
const VIDEO_CONCURRENCY = 2;

type Browser = Awaited<ReturnType<typeof openBrowser>>;

/**
 * Renderizador real das prévias. O bundle do Remotion e o Chrome ficam abertos entre uma cena e outra:
 * rebundla só quando algum fonte mudou (`bundleVersion`) e o webpack reaproveita o cache em disco.
 */
export function createRemotionRenderer(): PreviewRenderer {
  let serveUrl: string | null = null;
  let bundledVersion: number | null = null;
  let browser: Browser | null = null;

  async function ensureBundle(job: RenderJob, hooks: RenderHooks): Promise<string> {
    if (serveUrl && bundledVersion === job.bundleVersion) return serveUrl;
    hooks.onProgress('bundle', overallPercent('bundle', 0));
    try {
      serveUrl = await bundle({
        entryPoint: MOTION_ENTRY,
        publicDir: ASSETS_DIR,
        // pasta fixa: sem isso cada rebundle deixaria uma pasta nova no temp
        outDir: join(tmpdir(), 'mce-preview-bundle'),
        onProgress: (percent) => hooks.onProgress('bundle', overallPercent('bundle', percent / 100)),
      });
    } catch (error) {
      serveUrl = null;
      throw new PreviewBundleError(error instanceof Error ? error.message : String(error));
    }
    bundledVersion = job.bundleVersion;
    return serveUrl;
  }

  return {
    async render(job, hooks): Promise<RenderResult> {
      const url = await ensureBundle(job, hooks);
      const { cancelSignal, cancel } = makeCancelSignal();
      hooks.signal.addEventListener('abort', cancel, { once: true });
      if (hooks.signal.aborted) throw new Error('cancelado');
      try {
        browser ??= await openBrowser('chrome', { chromiumOptions: CHROMIUM_OPTIONS });
        const shared = { serveUrl: url, puppeteerInstance: browser, chromiumOptions: CHROMIUM_OPTIONS };
        const composition = await selectComposition({ ...shared, id: job.compositionId }).catch((error: unknown) => {
          // o Root inteiro falhou ao montar (erro em tempo de import de alguma cena)
          throw new PreviewBundleError(error instanceof Error ? error.message : String(error));
        });

        const stripStart = Date.now();
        const frames = stripFrames(composition.durationInFrames);
        const strip: StripFrame[] = [];
        for (const [index, frame] of frames.entries()) {
          hooks.onProgress('strip', overallPercent('strip', index / frames.length));
          const file = `${job.prefix}-f${String(frame).padStart(4, '0')}.jpg`;
          await renderStill({
            ...shared,
            composition,
            frame,
            output: join(job.outDir, file),
            imageFormat: 'jpeg',
            jpegQuality: 82,
            scale: STRIP_WIDTH / composition.width,
            cancelSignal,
          });
          strip.push({ frame, file });
        }
        const info = { fps: composition.fps, durationInFrames: composition.durationInFrames, width: composition.width, height: composition.height };
        const stripResult = { ...info, strip, stripMs: Date.now() - stripStart };
        hooks.onStrip(stripResult);
        if (!job.video) return { ...stripResult, video: null, videoMs: null };

        const videoStart = Date.now();
        const video = `${job.prefix}-preview.mp4`;
        await renderMedia({
          ...shared,
          composition,
          codec: 'h264',
          crf: 28,
          x264Preset: 'veryfast',
          imageFormat: 'jpeg',
          jpegQuality: 75,
          scale: VIDEO_SCALE,
          concurrency: VIDEO_CONCURRENCY,
          muted: true,
          cancelSignal,
          outputLocation: join(job.outDir, video),
          onProgress: ({ progress }) => hooks.onProgress('video', overallPercent('video', progress)),
        });
        return { ...stripResult, video, videoMs: Date.now() - videoStart };
      } finally {
        hooks.signal.removeEventListener('abort', cancel);
      }
    },

    async release() {
      const open = browser;
      browser = null;
      await open?.close({ silent: true }).catch(() => undefined);
    },
  };
}
