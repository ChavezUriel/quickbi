import { UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { missing, recommended, compatible, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ClvDashboard } from './components/clv-dashboard';
import { useClvConfig } from './use-clv-config';

function ClvWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useClvConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <ClvDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
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
      return recommended('Cliente, fecha e importe detectados para cálculo de CLV.', matched, matchedFields);
    }
    return compatible('Estructura apta para análisis de CLV.', matched, matchedFields);
  },
  Workspace: ClvWorkspace,
};
