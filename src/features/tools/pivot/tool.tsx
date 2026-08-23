import { Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { PivotDashboard } from './components/pivot-dashboard';
import { usePivotConfig } from './use-pivot-config';

function PivotWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = usePivotConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <PivotDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
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
  needs: ['Al menos una columna de categorías', 'Métrica numérica (opcional)'],
  // La tabla pone su propio scroll interno y no necesita la ventana entera.
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de texto o booleana.');
    }
    const dimCol = capabilities.dimensionNames[0]!;
    const metricCol = capabilities.measureNames[0] ?? null;
    const matched = [dimCol, metricCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Al menos una columna de categorías', column: dimCol },
      { need: 'Métrica numérica (opcional)', column: metricCol },
    ];
    return compatible('Listo para construir tabla dinámica cruzada.', matched, matchedFields);
  },
  Workspace: PivotWorkspace,
};
