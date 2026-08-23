import { ChartColumn } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { BuilderDashboard } from './components/builder-dashboard';
import { useBuilderConfig } from './use-builder-config';

function BuilderWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useBuilderConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
      dashboard={<BuilderDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const builderTool: ToolDefinition = {
  id: 'constructor',
  label: 'Constructor de gráficos',
  tagline: '¿Y si lo miro de otra manera?',
  description:
    'Barras, líneas, área, circular o dispersión, con la columna que quieras en cada eje. Es la salida cuando ninguna de las demás herramientas hace exactamente la pregunta que tienes.',
  icon: ChartColumn,
  category: 'general',
  needs: ['Una categoría o fecha', 'Una métrica numérica (opcional)'],
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0 && capabilities.dates === 0) {
      return missing('Hace falta una columna de categorías o de fecha.');
    }
    const axisCol = capabilities.dimensionNames[0] ?? capabilities.dateColumnNames[0];
    const metricCol = capabilities.measureNames[0] ?? null;
    const matched = [axisCol, metricCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Una categoría o fecha', column: axisCol },
      { need: 'Una métrica numérica (opcional)', column: metricCol },
    ];
    return compatible('Listo para personalizar visualizaciones a medida.', matched, matchedFields);
  },
  Workspace: BuilderWorkspace,
};
