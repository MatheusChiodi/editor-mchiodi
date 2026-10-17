import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { offlineGoogleFonts } from './fonts-plugin.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * UI do MChiodi Cut. `pnpm cut:dev` sobe o Vite com proxy de /api para o `mce cut` (porta em CUT_API, padrão 4870);
 * `pnpm cut:build` gera cut/dist, que o próprio `mce cut` serve.
 */
export default defineConfig({
  root,
  base: '/',
  // build 100% offline: as fontes do tema vão empacotadas em dist/fonts (cut/src/lib/fonts.ts)
  plugins: [offlineGoogleFonts(), react(), tailwindcss()],
  // os componentes do Remotion pedem arquivos por staticFile(): a mesma pasta que o render usa
  publicDir: fileURLToPath(new URL('../assets', import.meta.url)),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: false,
    chunkSizeWarningLimit: 6000,
  },
  server: {
    port: 5180,
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.CUT_API ?? 4870}`, changeOrigin: false },
    },
  },
});
