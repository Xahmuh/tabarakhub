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
              if (moduleId.includes('/app/dashboard/')) return 'module-dashboard';
              if (moduleId.includes('/app/delivery/')) return 'module-delivery';
              if (moduleId.includes('/app/block-analyzer/')) return 'module-block-analyzer';
              if (moduleId.includes('/app/spin-win/')) return 'module-spin-win';
              if (moduleId.includes('/app/owner-dashboard/')) return 'module-owner-dashboard';
              if (moduleId.includes('/app/modules/quality-feedback/')) return 'module-quality-feedback';
              if (moduleId.includes('/app/project-settings/')) return 'module-settings';
              if (!id.includes('node_modules')) return undefined;
              if (moduleId.includes('/@supabase/')) return 'vendor-supabase';
              if (moduleId.includes('/react/') || moduleId.includes('/react-dom/')) return 'vendor-react';
              if (moduleId.includes('/pdfjs-dist/')) return 'vendor-pdf';
              if (moduleId.includes('/exceljs/') || moduleId.includes('/file-saver/')) return 'vendor-excel';
              if (moduleId.includes('/lucide-react/')) return 'vendor-icons';
              if (moduleId.includes('/recharts/')) return 'vendor-charts';
              if (moduleId.includes('/sweetalert2/')) return 'vendor-alerts';
              if (
                moduleId.includes('/docx/')
                || moduleId.includes('/html-to-image/')
                || moduleId.includes('/qrcode.react/')
                || moduleId.includes('/canvas-confetti/')
                || moduleId.includes('/react-to-print/')
              ) return 'vendor-tools';
              return undefined;
            },
          },
        },
      }
    };
});
