import { Users } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { missing, recommended, compatible, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { CohortsDashboard } from './components/cohorts-dashboard';
import { useCohortsConfig } from './use-cohorts-config';

function CohortsWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useCohortsConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
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
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha de compra.');
    if (capabilities.measures === 0) return missing('Hace falta una columna de importe.');
    if (capabilities.identifiers === 0 && !capabilities.semantics.hasCustomer) {
      return missing('Hace falta una columna que identifique al cliente.');
    }
    const customerCol = capabilities.semantics.customerColumn ?? capabilities.identifierNames[0] ?? capabilities.dimensionNames[0];
    const dateCol = capabilities.dateColumnNames[0];
    const measureCol = capabilities.measureNames[0];
    const matched = [customerCol, dateCol, measureCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Una columna de cliente', column: customerCol },
      { need: 'Una fecha de compra', column: dateCol },
      { need: 'Un importe', column: measureCol },
    ];

    if (capabilities.semantics.hasCustomer) {
      return recommended('Cliente, fecha de primera compra e importe detectados.', matched, matchedFields);
    }
    return compatible('Estructura apta para análisis de cohortes.', matched, matchedFields);
  },
  Workspace: CohortsWorkspace,
};
