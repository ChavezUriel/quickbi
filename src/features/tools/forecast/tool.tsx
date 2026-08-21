import { TrendingUp } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ForecastDashboard } from './components/forecast-dashboard';
import { ForecastSetup } from './components/forecast-setup';
import { useForecastConfig } from './use-forecast-config';

function ForecastWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useForecastConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<ForecastSetup state={state} />}
      dashboard={<ForecastDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const forecastTool: ToolDefinition = {
  id: 'forecast',
  label: 'Pronóstico',
  tagline: '¿Cómo evolucionará la demanda futura?',
  description:
    'Proyección predictiva con Holt-Winters y modelos estacionales, intervalos de confianza al 80% y 95%, selector de horizonte y validación por backtesting (MAPE / RMSE).',
  icon: TrendingUp,
  category: 'temporal',
  needs: ['Una columna de fecha', 'Una columna numérica'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha.');
    if (capabilities.measures === 0) return missing('Hace falta una columna numérica.');
    return AVAILABLE;
  },
  Workspace: ForecastWorkspace,
};
