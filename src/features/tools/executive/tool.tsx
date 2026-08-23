import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compatible, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ExecutiveDashboard } from './components/executive-dashboard';
import { useExecutiveConfig } from './use-executive-config';

function ExecutiveWorkspace({ dataset, mapping, fill, onReady }: ToolWorkspaceProps) {
  const state = useExecutiveConfig(mapping);
  useToolReady(onReady, true);

  return (
    <div className={cn(fill && '3xl:min-h-0 3xl:flex-1')}>
      <ExecutiveDashboard dataset={dataset} mapping={mapping} state={state} />
    </div>
  );
}

export const executiveTool: ToolDefinition = {
  id: 'executive',
  label: 'Resumen ejecutivo',
  tagline: '¿Cuál es la síntesis estratégica y el diagnóstico global?',
  description:
    'Redacta un informe narrativo estructurado en lenguaje natural con las conclusiones clave: dirección de tendencia, principales impulsores, concentración de Pareto, picos y anomalías estadísticas.',
  icon: Sparkles,
  category: 'general',
  needs: ['Una métrica numérica', 'Columna de fecha (opcional)', 'Categoría (opcional)'],
  fill: false,
  requires: (capabilities) => {
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica.');
    }
    const measureCol = capabilities.measureNames[0]!;
    const dateCol = capabilities.dateColumnNames[0] ?? null;
    const dimCol = capabilities.dimensionNames[0] ?? null;
    const matched = [measureCol, dateCol, dimCol].filter(Boolean) as string[];
    const matchedFields = [
      { need: 'Una métrica numérica', column: measureCol },
      { need: 'Columna de fecha (opcional)', column: dateCol },
      { need: 'Categoría (opcional)', column: dimCol },
    ];
    return compatible('Listo para generar síntesis narrativa ejecutiva.', matched, matchedFields);
  },
  Workspace: ExecutiveWorkspace,
};
