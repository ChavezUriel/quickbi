import { Sparkles } from 'lucide-react';
import { ToolPanes } from '../components/tool-panes';
import { AVAILABLE, missing, type ToolDefinition, type ToolWorkspaceProps } from '../types';
import { useToolReady } from '../use-tool-ready';
import { ExecutiveDashboard } from './components/executive-dashboard';
import { ExecutiveSetup } from './components/executive-setup';
import { useExecutiveConfig } from './use-executive-config';

function ExecutiveWorkspace({ dataset, mapping, view, fill, onReady }: ToolWorkspaceProps) {
  const state = useExecutiveConfig(mapping);
  useToolReady(onReady, state.ready);

  return (
    <ToolPanes
      view={view}
      fill={fill}
      setup={<ExecutiveSetup state={state} />}
      dashboard={<ExecutiveDashboard dataset={dataset} mapping={mapping} state={state} />}
    />
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
  needs: ['Una métrica numérica', 'Opcional: columna de fecha y categoría'],
  hasSetup: true,
  fill: false,
  requires: (capabilities) => {
    if (capabilities.measures === 0) {
      return missing('Hace falta al menos una columna numérica.');
    }
    return AVAILABLE;
  },
  Workspace: ExecutiveWorkspace,
};
