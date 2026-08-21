import { Calendar } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { SeasonalityDashboard } from './components/seasonality-dashboard';
import { SeasonalitySetup } from './components/seasonality-setup';
import { useSeasonalityConfig } from './use-seasonality-config';

function SeasonalityWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useSeasonalityConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<SeasonalitySetup state={state} />}
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
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha.');
    if (capabilities.measures === 0) return missing('Hace falta una columna numérica.');
    return AVAILABLE;
  },
  Workspace: SeasonalityWorkspace,
};
