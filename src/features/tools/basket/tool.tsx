import { ShoppingBag } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { BasketDashboard } from './components/basket-dashboard';
import { BasketSetup } from './components/basket-setup';
import { useBasketConfig } from './use-basket-config';

function BasketWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useBasketConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<BasketSetup state={state} />}
      dashboard={<BasketDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const basketTool: ToolDefinition = {
  id: 'basket',
  label: 'Cesta de la compra',
  tagline: '¿Qué productos se compran juntos en el mismo ticket?',
  description:
    'Minería de reglas de asociación y afinidad entre productos (Market Basket Analysis). Calcula soporte, confianza y lift para venta cruzada, packs y recomendaciones.',
  icon: ShoppingBag,
  category: 'clientes',
  needs: ['Columna de producto', 'Columna de pedido / ticket'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions < 2 && capabilities.identifiers === 0) {
      return missing('Hacen falta al menos dos columnas de texto (producto y pedido/ticket).');
    }
    return AVAILABLE;
  },
  Workspace: BasketWorkspace,
};
