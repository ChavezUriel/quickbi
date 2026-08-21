import { Scale } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { missing, recommended, compatible, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ReconciliationDashboard } from './components/reconciliation-dashboard';
import { ReconciliationSetup } from './components/reconciliation-setup';
import { useReconciliationConfig } from './use-reconciliation-config';

function ReconciliationWorkspace({
  dataset,
  mapping,
  view,
  fill,
  onReady,
}: ToolWorkspaceProps) {
  const state = useReconciliationConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<ReconciliationSetup state={state} />}
      dashboard={
        <ReconciliationDashboard
          dataset={dataset}
          mapping={mapping}
          state={state}
        />
      }
    />
  );
}

export const reconciliationTool: ToolDefinition = {
  id: 'reconciliation',
  label: 'Conciliación de datos',
  tagline: '¿Cuadran los importes entre dos sistemas o fuentes?',
  description:
    'Compara registros por clave identificadora (facturas, IDs, transacciones) entre dos fuentes o columnas de importe. Identifica coincidencias exactas, discrepancias de valor y transacciones ausentes en una de las partes.',
  icon: Scale,
  category: 'situacional',
  needs: ['Una clave identificadora', 'Uno o dos importes numéricos'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de texto con la clave identificadora.');
    }
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica para conciliar importes.');
    }
    if (capabilities.semantics.hasReconciliation && capabilities.semantics.reconciliationColumns.length >= 2) {
      return recommended(
        'Columnas de conciliación y descuadres detectadas.',
        capabilities.semantics.reconciliationColumns.slice(0, 2),
      );
    }
    if (capabilities.measures >= 2) {
      return compatible(
        'Estructura apta para conciliar entre dos métricas.',
        capabilities.measureNames.slice(0, 2),
      );
    }
    return missing('Hacen falta al menos dos columnas numéricas para comparar o conciliar importes entre fuentes.');
  },
  Workspace: ReconciliationWorkspace,
};
