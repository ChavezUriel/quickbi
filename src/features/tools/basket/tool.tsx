import { ShoppingBag } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { missing, recommended, compatible, type ToolDefinition, type ToolWorkspaceProps } from '../types';
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
    if (capabilities.semantics.hasOrder && capabilities.semantics.hasProduct) {
      return recommended('Pedido/ticket y producto detectados para minería de cesta.', [
        capabilities.semantics.orderColumn!,
        capabilities.semantics.productColumn!,
      ]);
    }
    if (capabilities.dimensions >= 2 || (capabilities.dimensions >= 1 && capabilities.identifiers >= 1)) {
      return compatible('Dos dimensiones disponibles para analizar afinidades.', capabilities.dimensionNames.slice(0, 2));
    }
    return missing('Hacen falta columnas de pedido y producto para asociar elementos en la cesta.');
  },
  Workspace: BasketWorkspace,
};
