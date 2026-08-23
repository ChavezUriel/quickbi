import { Percent } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ParetoDashboard } from './components/pareto-dashboard';
import { useParetoConfig } from './use-pareto-config';

function ParetoWorkspace({
  dataset,
  mapping,
  view,
  fill,
  onReady,
}: ToolWorkspaceProps) {
  const state = useParetoConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
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
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de categorías o entidades.');
    }
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica para medir la concentración.');
    }
    const entityCol =
      capabilities.semantics.productColumn ??
      capabilities.identifierNames[0] ??
      capabilities.dimensionNames[0]!;
    const metricCol = capabilities.measureNames[0]!;
    const matched = [entityCol, metricCol];
    const matchedFields = [
      { need: 'Una columna de entidades o productos', column: entityCol },
      { need: 'Una columna numérica', column: metricCol },
    ];
    return compatible('Estructura apta para análisis Pareto 80/20.', matched, matchedFields);
  },
  Workspace: ParetoWorkspace,
};
