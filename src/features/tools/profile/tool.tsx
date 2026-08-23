import { ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ProfileDashboard } from './components/profile-dashboard';

function ProfileWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <ProfileDashboard dataset={dataset} mapping={mapping} />
    </div>
  );
}

export const profileTool: ToolDefinition = {
  id: 'perfil',
  label: 'Perfil de datos',
  tagline: '¿Con qué datos puedo contar?',
  description:
    'Una ficha por columna: qué hay dentro, cuánto falta, qué no convierte y cómo se reparten los valores. Es lo que conviene mirar antes de sacar conclusiones de cualquier otra herramienta.',
  icon: ClipboardList,
  category: 'general',
  needs: ['Cualquier tabla'],
  // Crece con el número de columnas: es un documento, no un cuadro de mando.
  fill: false,
  requires: (capabilities) => {
    if (capabilities.columnCount === 0) {
      return missing('El dataset no tiene columnas.');
    }
    const matched = capabilities.dimensionNames
      .concat(capabilities.measureNames, capabilities.dateColumnNames)
      .slice(0, 3);
    const matchedFields = [
      { need: 'Cualquier tabla', column: `${capabilities.columnCount} columnas` },
    ];
    return compatible('Listo para perfilar calidad y distribución del dataset.', matched, matchedFields);
  },
  Workspace: ProfileWorkspace,
};
