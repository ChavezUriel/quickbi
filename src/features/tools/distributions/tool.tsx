import { BarChart3 } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { DistributionsDashboard } from './components/distributions-dashboard';
import { useDistributionsConfig } from './use-distributions-config';

function DistributionsWorkspace({
  dataset,
  mapping,
  view,
  fill,
  onReady,
}: ToolWorkspaceProps) {
  const state = useDistributionsConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
      dashboard={
        <DistributionsDashboard dataset={dataset} mapping={mapping} state={state} />
      }
    />
  );
}

export const distributionsTool: ToolDefinition = {
  id: 'distribuciones',
  label: 'Distribuciones y atípicos',
  tagline: '¿Cómo se reparten los valores y qué anomalías hay?',
  description:
    'Histograma con intervalos dinámicos (Freedman-Diaconis), diagrama de caja (boxplot) con resumen de 5 números y detección de valores atípicos mediante IQR, con desglose opcional por categoría.',
  icon: BarChart3,
  category: 'general',
  needs: ['Al menos una columna numérica'],
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica para analizar su distribución.');
    }
    const measureCol = capabilities.measureNames[0]!;
    const matched = [measureCol];
    const matchedFields = [
      { need: 'Al menos una columna numérica', column: measureCol },
    ];
    return compatible('Distribución y boxplot listos.', matched, matchedFields);
  },
  Workspace: DistributionsWorkspace,
};
