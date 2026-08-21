import { ChartColumn } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { BuilderDashboard } from './components/builder-dashboard';
import { BuilderSetup } from './components/builder-setup';
import { useBuilderConfig } from './use-builder-config';

function BuilderWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useBuilderConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<BuilderSetup state={state} />}
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
  needs: ['Una categoría o una fecha'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) =>
    capabilities.dimensions === 0 && capabilities.dates === 0
      ? missing('Hace falta una columna de categorías o de fecha.')
      : AVAILABLE,
  Workspace: BuilderWorkspace,
};
