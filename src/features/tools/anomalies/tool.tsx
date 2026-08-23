import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { AnomaliesDashboard } from './components/anomalies-dashboard';
import { useAnomaliesConfig } from './use-anomalies-config';

function AnomaliesWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useAnomaliesConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <AnomaliesDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
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
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha para el análisis temporal.');
    if (capabilities.measures === 0) return missing('Hace falta una métrica cuantitativa a supervisar.');
    const dateCol = capabilities.dateColumnNames[0]!;
    const metricCol = capabilities.measureNames[0]!;
    const matched = [dateCol, metricCol];
    const matchedFields = [
      { need: 'Una columna de fecha', column: dateCol },
      { need: 'Una métrica cuantitativa', column: metricCol },
    ];
    return compatible('Serie temporal y métrica listas para supervisión.', matched, matchedFields);
  },
  Workspace: AnomaliesWorkspace,
};
