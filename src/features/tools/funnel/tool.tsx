import { Filter } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { FunnelDashboard } from './components/funnel-dashboard';
import { FunnelSetup } from './components/funnel-setup';
import { useFunnelConfig } from './use-funnel-config';

function FunnelWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useFunnelConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<FunnelSetup state={state} />}
      dashboard={<FunnelDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const funnelTool: ToolDefinition = {
  id: 'funnel',
  label: 'Embudo de conversión',
  tagline: '¿Dónde se pierden los usuarios y clientes en el proceso?',
  description:
    'Analiza la retención paso a paso a lo largo de las etapas de ventas, registro o flujos operativos. Cuantifica caídas (drop-offs), identifica el mayor cuello de botella y calcula la tasa de conversión global.',
  icon: Filter,
  category: 'situacional',
  needs: ['Una columna de etapa o fase', 'Una métrica de importe o conteo (opcional)'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de texto con las etapas.');
    }
    return AVAILABLE;
  },
  Workspace: FunnelWorkspace,
};
