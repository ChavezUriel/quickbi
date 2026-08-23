import { Filter } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { compatible, missing, recommended, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { FunnelDashboard } from './components/funnel-dashboard';
import { useFunnelConfig } from './use-funnel-config';

function FunnelWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useFunnelConfig(mapping);
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={null}
      dashboard={<FunnelDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
  );
}

export const funnelTool: ToolDefinition = {
  id: 'funnel',
  label: 'Embudo de conversión',
  tagline: '¿Dónde se pierden los usuarios y clientes en el proceso?',
  description:
    'Analiza la retención paso a paso a lo largo de las etapas de ventas, registro o flujos operativos. Cuantifica caídas (drop-offs), identifica el mayor cuello de botella y calcula la tasa de conversión global.',
  icon: Filter,
  category: 'situacional',
  needs: ['Una columna de etapa o fase', 'Una métrica de importe o conteo (opcional)'],
  hasSetup: false,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.dimensions === 0) {
      return missing('Hace falta al menos una columna de texto con las etapas.');
    }
    const stageCol = capabilities.semantics.funnelColumn ?? capabilities.dimensionNames[0]!;
    const metricCol = capabilities.measureNames[0] ?? null;
    const matched = [stageCol, metricCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Una columna de etapa o fase', column: stageCol },
      { need: 'Una métrica de importe o conteo (opcional)', column: metricCol },
    ];

    if (capabilities.semantics.hasFunnelStage) {
      return recommended(
        `Etapas de embudo detectadas en "${capabilities.semantics.funnelColumn}".`,
        matched,
        matchedFields,
      );
    }
    return compatible(
      'Estructura apta para embudo de conversión.',
      matched,
      matchedFields,
    );
  },
  Workspace: FunnelWorkspace,
};
