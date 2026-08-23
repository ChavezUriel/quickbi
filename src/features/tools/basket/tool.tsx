import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { missing, recommended, compatible, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { BasketDashboard } from './components/basket-dashboard';
import { useBasketConfig } from './use-basket-config';

function BasketWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useBasketConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <BasketDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
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
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions < 2 && capabilities.identifiers === 0) {
      return missing('Hacen falta al menos dos columnas de texto (producto y pedido/ticket).');
    }
    const productCol = capabilities.semantics.productColumn ?? capabilities.dimensionNames[0];
    const orderCol =
      capabilities.semantics.orderColumn ??
      capabilities.identifierNames[0] ??
      (capabilities.dimensionNames.find((d) => d !== productCol) ?? capabilities.dimensionNames[1] ?? capabilities.dimensionNames[0]);
    const matched = [orderCol, productCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Columna de producto', column: productCol },
      { need: 'Columna de pedido / ticket', column: orderCol },
    ];

    if (capabilities.semantics.hasOrder && capabilities.semantics.hasProduct) {
      return recommended('Pedido/ticket y producto detectados para minería de cesta.', [
        capabilities.semantics.orderColumn!,
        capabilities.semantics.productColumn!,
      ], matchedFields);
    }
    if (capabilities.dimensions >= 2 || (capabilities.dimensions >= 1 && capabilities.identifiers >= 1)) {
      return compatible('Dos dimensiones disponibles para analizar afinidades.', matched, matchedFields);
    }
    return missing('Hacen falta columnas de pedido y producto para asociar elementos en la cesta.');
  },
  Workspace: BasketWorkspace,
};
