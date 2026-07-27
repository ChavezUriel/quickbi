import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * QuickBI promete que los datos no salen del navegador. `connect-src 'none'`
 * convierte esa promesa en algo que el navegador impone y que cualquier usuario
 * puede verificar: bloquea fetch, XHR, WebSocket y sendBeacon. Si alguna
 * dependencia intentara llamar a casa, fallaría de forma visible en consola.
 *
 * Se inyecta solo en el build porque el HMR de Vite necesita un WebSocket en
 * desarrollo, que esta política bloquearía.
 *
 * Nota: `frame-ancestors` se ignora en <meta>; hay que servirlo como cabecera
 * HTTP (ver README).
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "connect-src 'none'",
    "script-src 'self'",
    // Tailwind compila a un fichero, pero varias librerías de UI y ECharts
    // aplican estilos inline en tiempo de ejecución.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')

  return {
    name: 'quickbi:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  // Los workers en formato IIFE (el de por defecto) no admiten code-splitting,
  // así que el import diferido de SheetJS se inlinearía dentro del worker y los
  // usuarios de CSV volverían a descargarlo. Con ESM sí se separa en un chunk.
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
