import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    const appBuildId = `${process.env.VERCEL_GIT_COMMIT_SHA || 'local'}-${Date.now()}`;
    return {
      define: {
        __APP_BUILD_ID__: JSON.stringify(appBuildId),
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'emit-app-build-version',
          generateBundle() {
            this.emitFile({
              type: 'asset',
              fileName: 'version.json',
              source: JSON.stringify({ version: appBuildId }),
            });
          },
        },
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 600,
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              const moduleId = id.replace(/\\/g, '/');
              // Keep only framework/auth primitives shared by the startup shell.
              // Feature and export libraries stay inside their lazy route chunks.
              if (moduleId.includes('/react/') || moduleId.includes('/react-dom/')) return 'vendor-react';
              if (moduleId.includes('/@supabase/')) return 'vendor-supabase';
              if (moduleId.includes('/lucide-react/')) return 'vendor-icons';
              return undefined;
            },
          },
        },
      }
    };
});
