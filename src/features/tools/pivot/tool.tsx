import { Table2 } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { PivotDashboard } from './components/pivot-dashboard';
import { PivotSetup } from './components/pivot-setup';
import { usePivotConfig } from './use-pivot-config';

function PivotWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = usePivotConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<PivotSetup state={state} />}
      dashboard={<PivotDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const pivotTool: ToolDefinition = {
  id: 'tabla-dinamica',
  label: 'Tabla dinámica',
  tagline: '¿Cuánto hay en cada cruce?',
  description:
    'Filas, columnas y una cifra en cada cruce, con totales por ambos lados y mapa de calor. Las columnas pueden ser otra categoría o el tiempo, para leer la evolución sin salir de la tabla.',
  icon: Table2,
  category: 'general',
  needs: ['Al menos una columna de categorías'],
  hasSetup: true,
  // La tabla pone su propio scroll interno y no necesita la ventana entera.
  fill: false,
  requires: (capabilities) =>
    capabilities.dimensions === 0
      ? missing('Hace falta al menos una columna de texto o booleana.')
      : AVAILABLE,
  Workspace: PivotWorkspace,
};
