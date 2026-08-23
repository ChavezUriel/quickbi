import { Grid3x3 } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { missing, recommended, compatible, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { RfmDashboard } from './components/rfm-dashboard';
import { useRfmConfig } from './use-rfm-config';

function RfmWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useRfmConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
      dashboard={<RfmDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const rfmTool: ToolDefinition = {
  id: 'rfm',
  label: 'Matriz RFM',
  tagline: '¿Qué clientes valen y cuáles se están yendo?',
  description:
    'Reparte la cartera en 25 casillas según lo reciente y lo frecuente de sus compras, y la resume en ocho segmentos con su importe. Cada casilla lleva a la lista de quién está dentro.',
  icon: Grid3x3,
  category: 'clientes',
  needs: ['Una columna de cliente', 'Una fecha', 'Un importe'],
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dates === 0) return missing('Hace falta una columna de fecha.');
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
      { need: 'Una fecha', column: dateCol },
      { need: 'Un importe', column: measureCol },
    ];

    if (capabilities.semantics.hasCustomer) {
      return recommended('Cliente, fecha de compra e importe detectados.', matched, matchedFields);
    }
    return compatible('Estructura apta para segmentación RFM.', matched, matchedFields);
  },
  Workspace: RfmWorkspace,
};
