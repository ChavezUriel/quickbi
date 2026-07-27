import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // La lógica de parsing no toca el DOM: `File`, `Blob` y `TextDecoder` son
    // globales en Node 20+, así que no hace falta simular un navegador.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
