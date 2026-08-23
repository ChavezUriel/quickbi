import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, recommended, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { GeoMapDashboard } from './components/geo-map-dashboard';
import { useGeoMapConfig } from './use-geo-map-config';

function GeoMapWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useGeoMapConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <GeoMapDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
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
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de texto con la ubicación o país.');
    }
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica para agregar.');
    }
    const geoCol = capabilities.semantics.geoColumn ?? capabilities.dimensionNames[0]!;
    const metricCol = capabilities.measureNames[0]!;
    const matched = [geoCol, metricCol];
    const matchedFields = [
      { need: 'Una columna de territorio o país', column: geoCol },
      { need: 'Una columna de importe o métrica', column: metricCol },
    ];

    if (capabilities.semantics.hasGeo) {
      return recommended(
        `Desglose geográfico detectado en "${capabilities.semantics.geoColumn}".`,
        matched,
        matchedFields,
      );
    }
    return compatible(
      'Estructura apta para distribución territorial.',
      matched,
      matchedFields,
    );
  },
  Workspace: GeoMapWorkspace,
};
