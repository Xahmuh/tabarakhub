import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
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
