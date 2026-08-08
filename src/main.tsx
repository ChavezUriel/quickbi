import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from '@/components/error-boundary';
import { applyTheme, readStoredTheme } from '@/lib/theme';

applyTheme(readStoredTheme());

const container = document.getElementById('root');
if (!container) throw new Error('No se ha encontrado el contenedor #root.');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
