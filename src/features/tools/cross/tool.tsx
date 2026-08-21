import { ChartNoAxesCombined } from 'lucide-react';
import { AnalysisDashboard } from '@/features/analysis/components/analysis-dashboard';
import { AnalysisSetup } from '@/features/analysis/components/analysis-setup';
import { useAnalysisConfig } from '@/features/analysis/use-analysis-config';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';

function CrossWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const analysis = useAnalysisConfig(mapping);

  // Siempre se puede avanzar: sin dimensiones el cuadro de mando analiza el
  // total, y sin métricas cuenta filas. Nunca se queda sin nada que enseñar.
  useToolReady(onReady, true);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={
        <div className="mx-auto w-full max-w-5xl">
          <AnalysisSetup state={analysis} />
        </div>
      }
      dashboard={
        <AnalysisDashboard dataset={dataset} mapping={mapping} analysis={analysis} />
      }
    />
  );
}

export const crossTool: ToolDefinition = {
  id: 'cruzado',
  label: 'Análisis cruzado',
  tagline: '¿Qué ha cambiado y quién lo ha movido?',
  description:
    'Evolución, crecimientos y caídas, y el detalle exacto, los tres filtrados a la vez: pulsar una categoría en cualquiera de ellos filtra el resto. Pensado para datos de venta con fecha.',
  icon: ChartNoAxesCombined,
  category: 'temporal',
  needs: ['Una fecha para la evolución', 'Categorías por las que abrir'],
  hasSetup: true,
  // El cuadro de mando quiere la ventana entera: filtrar y no ver a la vez el
  // total, la evolución y el detalle es perder lo que hace útil el gesto.
  fill: true,
  requires: () => AVAILABLE,
  Workspace: CrossWorkspace,
};
