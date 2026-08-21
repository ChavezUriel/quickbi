import { Boxes } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { InventoryDashboard } from './components/inventory-dashboard';
import { InventorySetup } from './components/inventory-setup';
import { useInventoryConfig } from './use-inventory-config';

function InventoryWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useInventoryConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<InventorySetup state={state} />}
      dashboard={<InventoryDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const inventoryTool: ToolDefinition = {
  id: 'inventory',
  label: 'Rotación de inventario',
  tagline: '¿Qué productos rotan rápido y cuánto stock muerto hay acumulado?',
  description:
    'Calcula el ratio de rotación (turnover) y los días de inventario (DSI). Segmenta el almacén en tramos de antigüedad (<30d, 31-60d, 61-90d, >90d) y clasifica el catálogo por velocidad de salida.',
  icon: Boxes,
  category: 'situacional',
  needs: ['Una columna de producto o SKU', 'Una columna de stock o existencias'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de texto con el producto o SKU.');
    }
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica con el stock o existencias.');
    }
    return AVAILABLE;
  },
  Workspace: InventoryWorkspace,
};
