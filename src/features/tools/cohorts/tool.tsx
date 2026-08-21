import { Users } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { CohortsDashboard } from './components/cohorts-dashboard';
import { CohortsSetup } from './components/cohorts-setup';
import { useCohortsConfig } from './use-cohorts-config';

function CohortsWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useCohortsConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<CohortsSetup state={state} />}
      dashboard={<CohortsDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const cohortsTool: ToolDefinition = {
  id: 'cohorts',
  label: 'Cohortes de retención',
  tagline: '¿Cuántos clientes vuelven a comprar mes a mes?',
  description:
    'Matriz triangular de calor por período de primera compra: mide qué porcentaje de clientes e ingresos se retiene en el tiempo y visualiza sus curvas de decaimiento.',
  icon: Users,
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
  Workspace: CohortsWorkspace,
};
