import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { SpcDashboard } from './components/spc-dashboard';
import { useSpcConfig } from './use-spc-config';

function SpcWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useSpcConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <SpcDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
  );
}

export const spcTool: ToolDefinition = {
  id: 'spc',
  label: 'Control de proceso SPC',
  tagline: '¿El proceso es estable o presenta causas especiales?',
  description:
    'Gráfica de control Shewhart con Línea Central, Límites UCL/LCL (±3σ), Zonas de advertencia y auditoría de violaciones según las Reglas de Western Electric y Nelson.',
  icon: Activity,
  category: 'situacional',
  needs: ['Una columna numérica a monitorear', 'Orden cronológico o lote (opcional)'],
  fill: false,
  requires: (capabilities) => {
    if (capabilities.measures === 0) {
      return missing('Hace falta una columna numérica para medir el control del proceso.');
    }
    const measureCol = capabilities.measureNames[0]!;
    const orderCol = capabilities.dateColumnNames[0] ?? capabilities.dimensionNames[0] ?? null;
    const matched = [measureCol, orderCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Una columna numérica a monitorear', column: measureCol },
      { need: 'Orden cronológico o lote (opcional)', column: orderCol },
    ];
    return compatible('Datos numéricos listos para gráfica de control estadístico SPC.', matched, matchedFields);
  },
  Workspace: SpcWorkspace,
};
