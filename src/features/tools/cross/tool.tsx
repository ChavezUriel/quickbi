import { ChartNoAxesCombined } from 'lucide-react';
import { AnalysisDashboard } from '@/features/analysis/components/analysis-dashboard';
import { useAnalysisConfig } from '@/features/analysis/use-analysis-config';
import { cn } from '@/lib/utils';
import { compatible, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';

function CrossWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const analysis = useAnalysisConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <AnalysisDashboard dataset={dataset} mapping={mapping} analysis={analysis} />
    </div>
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
  // El cuadro de mando quiere la ventana entera: filtrar y no ver a la vez el
  // total, la evolución y el detalle es perder lo que hace útil el gesto.
  fill: true,
  requires: (capabilities) => {
    const dateCol = capabilities.dateColumnNames[0] ?? null;
    const dimCol = capabilities.dimensionNames[0] ?? null;
    const matched = [dateCol, dimCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Una fecha para la evolución', column: dateCol },
      { need: 'Categorías por las que abrir', column: dimCol },
    ];
    return compatible('Estructura lista para análisis cruzado.', matched, matchedFields);
  },
  Workspace: CrossWorkspace,
};
