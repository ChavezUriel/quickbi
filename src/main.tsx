import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/error-boundary'
import { DatasetProvider } from '@/features/dataset/dataset-provider'
import { applyTheme, readStoredTheme } from '@/lib/theme'

// Antes del primer render, para no pintar en claro y saltar a oscuro.
// (Se hace aquí y no con un <script> inline en index.html para poder mantener
// `script-src 'self'` en el CSP, sin `unsafe-inline`.)
applyTheme(readStoredTheme())

const container = document.getElementById('root')
if (!container) throw new Error('No se ha encontrado el contenedor #root.')

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <DatasetProvider>
        <App />
      </DatasetProvider>
    </ErrorBoundary>
  </StrictMode>,
)
