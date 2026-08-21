import { Globe } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { GeoMapDashboard } from './components/geo-map-dashboard';
import { GeoMapSetup } from './components/geo-map-setup';
import { useGeoMapConfig } from './use-geo-map-config';

function GeoMapWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useGeoMapConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<GeoMapSetup state={state} />}
      dashboard={<GeoMapDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const geoMapTool: ToolDefinition = {
  id: 'geo_map',
  label: 'Mapa geográfico',
  tagline: '¿Cómo se reparten las ventas y métricas por territorio?',
  description:
    'Agrega métricas por país, región, provincia o ciudad de forma 100% offline. Calcula la concentración territorial (Top 3, Top 5 e índice Herfindahl) y permite explorar visualmente el ranking geográfico.',
  icon: Globe,
  category: 'general',
  needs: ['Una columna de territorio o país', 'Una columna de importe o métrica'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de texto con la ubicación o país.');
    }
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica para agregar.');
    }
    return AVAILABLE;
  },
  Workspace: GeoMapWorkspace,
};
