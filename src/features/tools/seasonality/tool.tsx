import { Calendar } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { SeasonalityDashboard } from './components/seasonality-dashboard';
import { useSeasonalityConfig } from './use-seasonality-config';

function SeasonalityWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useSeasonalityConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
      dashboard={<SeasonalityDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const seasonalityTool: ToolDefinition = {
  id: 'seasonality',
  label: 'Estacionalidad',
  tagline: '¿Cuándo se concentra la actividad del negocio?',
  description:
    'Desglosa patrones recurrentes por día de la semana y mes del año, calcula medias móviles y amplitud estacional para planificar demanda y recursos.',
  icon: Calendar,
  category: 'temporal',
  needs: ['Una columna de fecha', 'Una columna numérica'],
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha.');
    if (capabilities.measures === 0) return missing('Hace falta una columna numérica.');
    const dateCol = capabilities.dateColumnNames[0]!;
    const measureCol = capabilities.measureNames[0]!;
    const matched = [dateCol, measureCol];
    const matchedFields = [
      { need: 'Una columna de fecha', column: dateCol },
      { need: 'Una columna numérica', column: measureCol },
    ];
    return compatible('Serie temporal lista para patrones de estacionalidad.', matched, matchedFields);
  },
  Workspace: SeasonalityWorkspace,
};
