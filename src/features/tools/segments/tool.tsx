import { GitCompare } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { SegmentsDashboard } from './components/segments-dashboard';
import { SegmentsSetup } from './components/segments-setup';
import { useSegmentsConfig } from './use-segments-config';

function SegmentsWorkspace({
  dataset,
  mapping,
  view,
  fill,
  onReady,
}: ToolWorkspaceProps) {
  const state = useSegmentsConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<SegmentsSetup state={state} />}
      dashboard={
        <SegmentsDashboard dataset={dataset} mapping={mapping} state={state} />
      }
    />
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
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de categorías para definir los segmentos.');
    }
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica para comparar los segmentos.');
    }
    return AVAILABLE;
  },
  Workspace: SegmentsWorkspace,
};
