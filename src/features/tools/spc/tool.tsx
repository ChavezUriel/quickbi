import { Activity } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { SpcDashboard } from './components/spc-dashboard';
import { SpcSetup } from './components/spc-setup';
import { useSpcConfig } from './use-spc-config';

function SpcWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useSpcConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<SpcSetup state={state} />}
      dashboard={<SpcDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
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
  needs: ['Una columna numérica a monitorear', 'Opcional: orden cronológico o lote'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.measures === 0) {
      return missing('Hace falta una columna numérica para medir el control del proceso.');
    }
    return AVAILABLE;
  },
  Workspace: SpcWorkspace,
};
