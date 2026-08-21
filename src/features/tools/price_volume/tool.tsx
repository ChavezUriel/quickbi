import { SlidersHorizontal } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { PriceVolumeDashboard } from './components/price-volume-dashboard';
import { PriceVolumeSetup } from './components/price-volume-setup';
import { usePriceVolumeConfig } from './use-price-volume-config';

function PriceVolumeWorkspace({
  dataset,
  mapping,
  view,
  fill,
  onReady,
}: ToolWorkspaceProps) {
  const state = usePriceVolumeConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<PriceVolumeSetup state={state} />}
      dashboard={
        <PriceVolumeDashboard dataset={dataset} mapping={mapping} state={state} />
      }
    />
  );
}

export const priceVolumeTool: ToolDefinition = {
  id: 'price_volume',
  label: 'Precio vs volumen',
  tagline: '¿Cómo afectan los cambios de precio al volumen vendido?',
  description:
    'Dispersión de precio unitario vs volumen con ajuste de elasticidad precio de la demanda (PED) y descomposición Precio-Volumen-Mix (PVM) del crecimiento de ingresos.',
  icon: SlidersHorizontal,
  category: 'situacional',
  needs: [
    'Columna de producto',
    'Columna de volumen / cantidad',
    'Columna de precio o importe',
  ],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.measures < 1) {
      return missing('Hace falta al menos una columna numérica (volumen, precio o importe).');
    }
    if (capabilities.dimensions === 0 && capabilities.identifiers === 0) {
      return missing('Hace falta una columna que clasifique el producto o concepto.');
    }
    return AVAILABLE;
  },
  Workspace: PriceVolumeWorkspace,
};
