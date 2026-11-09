import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { offlineGoogleFonts } from '../cut/fonts-plugin.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Prévia ao vivo do vídeo da música. `pnpm music:build` gera music-preview/dist, que o `mce mv preview` serve junto com
 * /api/plan (o plano em disco), /api/audio (a música) e /api/events (aviso quando o plano muda).
 */
export default defineConfig({
  root,
  base: '/',
  // as fontes do tema vão empacotadas em dist/fonts (mesmo plugin do MChiodi Cut): a prévia funciona offline
  plugins: [offlineGoogleFonts(), react()],
  publicDir: false,
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 6000 },
  // `pnpm music:dev`: recarga instantânea ao mexer no código dos motivos, personagem e efeitos; /api vai para o `mce mv preview`
  server: {
    port: 5190,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.MV_API ?? 4880}`, changeOrigin: false } },
  },
});
