import { GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { SegmentsDashboard } from './components/segments-dashboard';
import { useSegmentsConfig } from './use-segments-config';

function SegmentsWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useSegmentsConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <SegmentsDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
  );
}

export const segmentsTool: ToolDefinition = {
  id: 'segmentos',
  label: 'Comparador de segmentos',
  tagline: '¿En qué se diferencian dos grupos de datos?',
  description:
    'Compara el Segmento A y el Segmento B frente a todas las métricas, calcula variaciones porcentuales (deltas) y descompone las diferencias mediante análisis Mix-Shift (efecto composición vs rendimiento).',
  icon: GitCompare,
  category: 'general',
  needs: ['Al menos una columna de categorías', 'Al menos una columna numérica'],
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de categorías para definir los segmentos.');
    }
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica para comparar los segmentos.');
    }
    const dimCol = capabilities.dimensionNames[0]!;
    const measureCol = capabilities.measureNames[0]!;
    const matched = [dimCol, measureCol];
    const matchedFields = [
      { need: 'Al menos una columna de categorías', column: dimCol },
      { need: 'Al menos una columna numérica', column: measureCol },
    ];
    return compatible('Categorías y métricas listas para comparativa de segmentos.', matched, matchedFields);
  },
  Workspace: SegmentsWorkspace,
};
