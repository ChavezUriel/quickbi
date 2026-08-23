import { Repeat } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { missing, recommended, compatible, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ChurnDashboard } from './components/churn-dashboard';
import { useChurnConfig } from './use-churn-config';

function ChurnWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useChurnConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
      dashboard={<ChurnDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const churnTool: ToolDefinition = {
  id: 'churn',
  label: 'Movimiento de clientes',
  tagline: '¿Cuántos clientes ganas, retienes y pierdes cada período?',
  description:
    'Mide la dinámica de clientes nuevos, recurrentes, reactivados y perdidos (churn). Calcula el Quick Ratio, la tasa de retención y el impacto en facturación con gráficos de flujo.',
  icon: Repeat,
  category: 'clientes',
  needs: ['Una columna de cliente', 'Una fecha', 'Un importe (opcional)'],
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha.');
    if (capabilities.identifiers === 0 && !capabilities.semantics.hasCustomer) {
      return missing('Hace falta una columna que identifique al cliente.');
    }
    const customerCol = capabilities.semantics.customerColumn ?? capabilities.identifierNames[0] ?? capabilities.dimensionNames[0];
    const dateCol = capabilities.dateColumnNames[0];
    const measureCol = capabilities.measureNames[0] ?? null;
    const matched = [customerCol, dateCol, measureCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Una columna de cliente', column: customerCol },
      { need: 'Una fecha', column: dateCol },
      { need: 'Un importe (opcional)', column: measureCol },
    ];

    if (capabilities.semantics.hasCustomer) {
      return recommended('Cliente y fecha detectados para medir retención y bajas.', matched, matchedFields);
    }
    return compatible('Estructura apta para análisis de churn.', matched, matchedFields);
  },
  Workspace: ChurnWorkspace,
};
