import { Activity } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { AnomaliesDashboard } from './components/anomalies-dashboard';
import { AnomaliesSetup } from './components/anomalies-setup';
import { useAnomaliesConfig } from './use-anomalies-config';

function AnomaliesWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useAnomaliesConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<AnomaliesSetup state={state} />}
      dashboard={<AnomaliesDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const anomaliesTool: ToolDefinition = {
  id: 'anomalies',
  label: 'Detección de anomalías',
  tagline: '¿Cuándo ocurrieron picos o caídas fuera de lo normal?',
  description:
    'Supervisa la serie temporal detectando valores atípicos y desvíos estadísticos con medias móviles, rangos intercuartiles y Z-Score sobre bandas de confianza configurables.',
  icon: Activity,
  category: 'temporal',
  needs: ['Una columna de fecha', 'Una métrica cuantitativa'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha para el análisis temporal.');
    if (capabilities.measures === 0) return missing('Hace falta una métrica cuantitativa a supervisar.');
    return AVAILABLE;
  },
  Workspace: AnomaliesWorkspace,
};
