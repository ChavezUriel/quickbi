import { Activity } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { missing, recommended, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { CorrelationsDashboard } from './components/correlations-dashboard';
import { CorrelationsSetup } from './components/correlations-setup';
import { useCorrelationsConfig } from './use-correlations-config';

function CorrelationsWorkspace({
  dataset,
  mapping,
  view,
  fill,
  onReady,
}: ToolWorkspaceProps) {
  const state = useCorrelationsConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<CorrelationsSetup state={state} />}
      dashboard={
        <CorrelationsDashboard dataset={dataset} mapping={mapping} state={state} />
      }
    />
  );
}

export const correlationsTool: ToolDefinition = {
  id: 'correlaciones',
  label: 'Correlaciones',
  tagline: '¿Qué variables se mueven juntas?',
  description:
    'Matriz de correlación de Pearson con mapa de calor entre todas las medidas, y diagrama de dispersión con recta de regresión lineal, ecuación y R² para examinar cualquier par.',
  icon: Activity,
  category: 'general',
  needs: ['Al menos dos columnas numéricas'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) =>
    capabilities.measures < 2
      ? missing('Hacen falta al menos dos columnas numéricas para calcular correlaciones.')
      : recommended(
          `${capabilities.measures} columnas numéricas para matriz de Pearson y dispersión.`,
          capabilities.measureNames.slice(0, 3),
        ),
  Workspace: CorrelationsWorkspace,
};
