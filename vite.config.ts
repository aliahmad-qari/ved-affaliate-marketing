import 'dotenv/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { app } from './server/app.ts';
import { connectDatabase } from './server/config/db.ts';

const expressBackendPlugin = (): Plugin => ({
  name: 'express-backend-plugin',
  configureServer(server) {
    // Connect only. Seed data is an explicit development operation.
    void connectDatabase();

    server.middlewares.use((req, res, next) => {
      if (req.url && (req.url.startsWith('/api/') || req.url === '/api')) {
        return app(req as any, res as any, next);
      }
      next();
    });
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), expressBackendPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

