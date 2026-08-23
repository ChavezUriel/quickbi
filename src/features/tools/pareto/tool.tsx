import { Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ParetoDashboard } from './components/pareto-dashboard';
import { useParetoConfig } from './use-pareto-config';

function ParetoWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useParetoConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <ParetoDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
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
