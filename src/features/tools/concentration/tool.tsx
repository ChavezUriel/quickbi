import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, recommended, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ConcentrationDashboard } from './components/concentration-dashboard';
import { useConcentrationConfig } from './use-concentration-config';

function ConcentrationWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useConcentrationConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <ConcentrationDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
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
  fill: false,
  requires: (capabilities) => {
    if (capabilities.measures === 0) {
      return missing('Hace falta una columna de importe o facturación.');
    }
    if (capabilities.dimensions === 0 && capabilities.identifiers === 0) {
      return missing('Hace falta una columna que identifique al cliente.');
    }
    const customerCol = capabilities.semantics.customerColumn ?? capabilities.identifierNames[0] ?? capabilities.dimensionNames[0];
    const measureCol = capabilities.measureNames[0];
    const matched = [customerCol, measureCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Columna de cliente', column: customerCol },
      { need: 'Columna de importe / facturación', column: measureCol },
    ];

    if (capabilities.semantics.hasCustomer) {
      return recommended('Cliente e importe detectados para curva de Lorenz y Gini.', matched, matchedFields);
    }
    return compatible('Estructura apta para concentración de clientes.', matched, matchedFields);
  },
  Workspace: ConcentrationWorkspace,
};
