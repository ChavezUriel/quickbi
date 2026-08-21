import { Percent } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ParetoDashboard } from './components/pareto-dashboard';
import { ParetoSetup } from './components/pareto-setup';
import { useParetoConfig } from './use-pareto-config';

function ParetoWorkspace({
  dataset,
  mapping,
  view,
  fill,
  onReady,
}: ToolWorkspaceProps) {
  const state = useParetoConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<ParetoSetup state={state} />}
      dashboard={
        <ParetoDashboard dataset={dataset} mapping={mapping} state={state} />
      }
    />
  );
}

export const paretoTool: ToolDefinition = {
  id: 'pareto',
  label: 'Análisis Pareto (ABC 80/20)',
  tagline: '¿Qué 20 % genera el 80 % del resultado?',
  description:
    'Curva de Pareto de doble eje, clasificación ABC (80/15/5) para productos o clientes, y métricas de concentración como el coeficiente de Gini.',
  icon: Percent,
  category: 'general',
  needs: ['Una columna de entidades o productos', 'Una columna numérica'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de categorías o entidades.');
    }
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica para medir la concentración.');
    }
    return AVAILABLE;
  },
  Workspace: ParetoWorkspace,
};
