import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Private family files (*.local.json: the MyHeritage import, research, places) exist only on
 * this computer. In a production build every one of them becomes an empty module, so they
 * can never be published — the live site reads its data from Supabase behind sign-in.
 */
function keepPrivateDataOut(): Plugin {
  const EMPTY = '\0private-data-removed';
  return {
    name: 'keep-private-data-out',
    apply: 'build',
    enforce: 'pre',
    resolveId(source) {
      return /\.local\.json$/.test(source) ? EMPTY : null;
    },
    load(id) {
      return id === EMPTY ? 'export default null;' : null;
    },
  };
}

export default defineConfig({
  plugins: [keepPrivateDataOut(), react()],
  base: './',
  // the upload copy and notes are rewritten by scripts; watching them can crash the dev server on Windows
  server: { watch: { ignored: ['**/upload.local/**', '**/notes.local/**', '**/design-backup.local/**', '**/dist/**'] } },
});
