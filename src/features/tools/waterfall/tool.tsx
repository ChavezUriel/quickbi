import { GitCompareArrows } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { WaterfallDashboard } from './components/waterfall-dashboard';
import { useWaterfallConfig } from './use-waterfall-config';

function WaterfallWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useWaterfallConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <WaterfallDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
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
  needs: ['Una columna de fecha', 'Una categoría', 'Una métrica numérica'],
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha para definir los períodos.');
    if (capabilities.measures === 0) return missing('Hace falta una columna numérica a descomponer.');
    if (capabilities.dimensions === 0) return missing('Hace falta al menos una categoría para el desglose.');
    const dateCol = capabilities.dateColumnNames[0]!;
    const dimCol = capabilities.dimensionNames[0]!;
    const measureCol = capabilities.measureNames[0]!;
    const matched = [dateCol, dimCol, measureCol];
    const matchedFields = [
      { need: 'Una columna de fecha', column: dateCol },
      { need: 'Una categoría', column: dimCol },
      { need: 'Una métrica numérica', column: measureCol },
    ];
    return compatible('Listo para puente de variación y desglose de cascada.', matched, matchedFields);
  },
  Workspace: WaterfallWorkspace,
};
