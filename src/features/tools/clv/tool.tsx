import { UserCheck } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ClvDashboard } from './components/clv-dashboard';
import { ClvSetup } from './components/clv-setup';
import { useClvConfig } from './use-clv-config';

function ClvWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useClvConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<ClvSetup state={state} />}
      dashboard={<ClvDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const clvTool: ToolDefinition = {
  id: 'clv',
  label: 'Valor de vida del cliente (CLV)',
  tagline: '¿Cuánto vale cada cliente a lo largo de su ciclo de vida?',
  description:
    'Calcula el CLV histórico y proyectado, ticket medio (AOV), frecuencia de compra, vida media y concentración de ingresos por deciles para priorizar la fidelización.',
  icon: UserCheck,
  category: 'clientes',
  needs: ['Una columna de cliente', 'Una fecha de compra', 'Un importe'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha de compra.');
    if (capabilities.measures === 0) return missing('Hace falta una columna de importe.');
    if (capabilities.identifiers === 0 && capabilities.dimensions === 0) {
      return missing('Hace falta una columna que identifique al cliente.');
    }
    return AVAILABLE;
  },
  Workspace: ClvWorkspace,
};
