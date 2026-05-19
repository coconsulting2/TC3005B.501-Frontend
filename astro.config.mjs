// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://astro.build/config
export default defineConfig({
  base: '/',
  output: "server",
  adapter: node({
    mode: 'standalone'
  }),
  server: {
    open: '/login'
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), basicSsl()],
    // basic-ssl + HMR por WebSocket en el mismo puerto HTTPS suele cerrar el WS
    // ("closed without opened"). Desactivar HMR evita ruido en consola; recarga manual.
    server: {
      hmr: false,
      // Force vite onto node:https (HTTP/1.1) instead of node:http2 — Bun's http2
      // polyfill crashes with "null is not an object (evaluating 'prop')" when
      // accessing incomingRequest.socket. An empty proxy object trips the
      // `if (proxy)` branch in vite's server factory without proxying anything.
      proxy: {
        'https://localhost:3000': {
          target: 'https://localhost:3000',
          changeOrigin: true,
          secure: false
        }
      },
      watch: {
        usePolling: true,
        interval: 100,
        depth: 100,
      }
    },
  },
  env: {
    schema: {
      PUBLIC_API_BASE_URL: envField.string({
        context: 'server',
        access: 'public',
      }),
      PUBLIC_IS_DEV: envField.boolean({
        default: false,
        context: 'server',
        access: 'public',
      })
    }
  }
});