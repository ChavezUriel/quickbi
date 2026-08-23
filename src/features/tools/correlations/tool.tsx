import { Activity } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { missing, recommended, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { CorrelationsDashboard } from './components/correlations-dashboard';
import { useCorrelationsConfig } from './use-correlations-config';

function CorrelationsWorkspace({
  dataset,
  mapping,
  view,
  fill,
  onReady,
}: ToolWorkspaceProps) {
  const state = useCorrelationsConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
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
  needs: ['Primera columna numérica', 'Segunda columna numérica'],
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.measures < 2) {
      return missing('Hacen falta al menos dos columnas numéricas para calcular correlaciones.');
    }
    const m1 = capabilities.measureNames[0]!;
    const m2 = capabilities.measureNames[1]!;
    const matched = capabilities.measureNames.slice(0, 3);
    const matchedFields = [
      { need: 'Primera columna numérica', column: m1 },
      { need: 'Segunda columna numérica', column: m2 },
    ];
    return recommended(
      `${capabilities.measures} columnas numéricas para matriz de Pearson y dispersión.`,
      matched,
      matchedFields,
    );
  },
  Workspace: CorrelationsWorkspace,
};
