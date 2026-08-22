import { GitCompareArrows } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { WaterfallDashboard } from './components/waterfall-dashboard';
import { useWaterfallConfig } from './use-waterfall-config';

function WaterfallWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useWaterfallConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
      dashboard={<WaterfallDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const waterfallTool: ToolDefinition = {
  id: 'waterfall',
  label: 'Puente de variación',
  tagline: '¿Qué ha impulsado el cambio entre dos períodos?',
  description:
    'Descompone la variación total de una métrica entre dos momentos en las aportaciones exactas de cada categoría: qué ha crecido, qué ha caído, qué es nuevo y qué se ha perdido con un gráfico de cascada.',
  icon: GitCompareArrows,
  category: 'situacional',
  needs: ['Una categoría', 'Una métrica numérica', 'Una columna de fecha'],
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha para definir los períodos.');
    if (capabilities.measures === 0) return missing('Hace falta una columna numérica a descomponer.');
    if (capabilities.dimensions === 0) return missing('Hace falta al menos una categoría para el desglose.');
    return AVAILABLE;
  },
  Workspace: WaterfallWorkspace,
};
