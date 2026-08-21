import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ToolView } from '../types';

/**
 * Los dos paneles de una herramienta, con el mismo trato que el resto del
 * asistente: el que no toca se oculta por CSS en vez de desmontarse, para que
 * ir a retocar la configuración y volver no borre los filtros del cuadro de
 * mando. El cuadro no se monta hasta que se llega a él: agregar el dataset
 * entero mientras el usuario aún elige columnas sería trabajo tirado.
 */
export function ToolPanes({
  view,
  fill,
  setup,
  dashboard,
}: {
  view: ToolView;
  fill: boolean;
  /** `null` en las herramientas que no preguntan nada. */
  setup: ReactNode;
  dashboard: ReactNode;
}) {
  const [dashboardMounted, setDashboardMounted] = useState(view === 'cuadro');
  if (view === 'cuadro' && !dashboardMounted) setDashboardMounted(true);

  return (
    // La cadena de alturas: para que el cuadro de mando pueda medir «lo que
    // queda de ventana», cada envoltorio entre `main` y él cede su altura en
    // vez de crecer con el contenido.
    <div className={cn(fill && '3xl:flex 3xl:min-h-0 3xl:flex-1 3xl:flex-col')}>
      {setup !== null && (
        <div style={{ display: view === 'configuracion' ? undefined : 'none' }}>
          {setup}
        </div>
      )}

      {dashboardMounted && (
        <div
          className={cn(fill && '3xl:min-h-0 3xl:flex-1')}
          style={{ display: view === 'cuadro' ? undefined : 'none' }}
        >
          {dashboard}
        </div>
      )}
    </div>
  );
}
