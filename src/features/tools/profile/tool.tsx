import { ClipboardList } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ProfileDashboard } from './components/profile-dashboard';

function ProfileWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  // No hay nada que configurar: en cuanto hay dataset, hay perfil.
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
      dashboard={<ProfileDashboard dataset={dataset} mapping={mapping} />}
    />
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
  hasSetup: false,
  // Crece con el número de columnas: es un documento, no un cuadro de mando.
  fill: false,
  requires: (capabilities) =>
    capabilities.columnCount === 0
      ? missing('El dataset no tiene columnas.')
      : AVAILABLE,
  Workspace: ProfileWorkspace,
};
