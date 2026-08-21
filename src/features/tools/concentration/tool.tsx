import { Scale } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ConcentrationDashboard } from './components/concentration-dashboard';
import { ConcentrationSetup } from './components/concentration-setup';
import { useConcentrationConfig } from './use-concentration-config';

function ConcentrationWorkspace({
  dataset,
  mapping,
  view,
  fill,
  onReady,
}: ToolWorkspaceProps) {
  const state = useConcentrationConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<ConcentrationSetup state={state} />}
      dashboard={
        <ConcentrationDashboard dataset={dataset} mapping={mapping} state={state} />
      }
    />
  );
}

export const concentrationTool: ToolDefinition = {
  id: 'concentration',
  label: 'Concentración de clientes',
  tagline: '¿Cuánto depende tu negocio de tus mayores clientes?',
  description:
    'Evalúa el riesgo de dependencia y desigualdad de tu cartera mediante la curva de Lorenz, el coeficiente de Gini, el índice HHI y la cuota del 20 % superior (Pareto).',
  icon: Scale,
  category: 'clientes',
  needs: ['Columna de cliente', 'Columna de importe / facturación'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.measures === 0) {
      return missing('Hace falta una columna de importe o facturación.');
    }
    if (capabilities.dimensions === 0 && capabilities.identifiers === 0) {
      return missing('Hace falta una columna que identifique al cliente.');
    }
    return AVAILABLE;
  },
  Workspace: ConcentrationWorkspace,
};
