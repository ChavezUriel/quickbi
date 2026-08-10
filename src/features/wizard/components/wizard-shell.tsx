import { useState } from 'react';
import { AppShell, SHELL_CONTAINER } from '@/components/app-shell';
import { cn } from '@/lib/utils';
import type { ParsedDataset } from '@/features/dataset/types';
import { useColumnMapping } from '@/features/mapping/use-column-mapping';
import { ColumnMapper } from '@/features/mapping/components/column-mapper';
import { AnalysisDashboard } from '@/features/analysis/components/analysis-dashboard';
import { AnalysisSetup } from '@/features/analysis/components/analysis-setup';
import { useAnalysisConfig } from '@/features/analysis/use-analysis-config';
import { useWizard } from '../use-wizard';
import { StepNavigation } from './step-navigation';
import { UploadStep } from './upload-step';
import { WizardHeader } from './wizard-header';

export function WizardShell() {
  const { step, composedDataset } = useWizard();

  // El cuadro de mando quiere la ventana entera; los pasos de carga y de tipos
  // son documentos que crecen con el número de columnas y quieren scroll.
  const fill = step === 3;

  return (
    <AppShell fill={fill}>
      <WizardHeader />

      <main
        className={cn(
          SHELL_CONTAINER,
          'flex-1 py-4 sm:py-6',
          fill && 'xl:flex xl:min-h-0 xl:flex-col xl:py-3',
        )}
      >
        {/* Paso 1: siempre montado, oculto cuando no es el activo. */}
        <div style={{ display: step === 1 ? undefined : 'none' }}>
          <UploadStep />
        </div>

        {/* Pasos 2 y 3: comparten el estado de mapeo vía DataWorkspace. */}
        {composedDataset && (
          <DataWorkspace
            key={composedDataset.id}
            dataset={composedDataset}
            hidden={step < 2}
            fill={fill}
          />
        )}
      </main>

      {step < 3 && <StepNavigation />}
    </AppShell>
  );
}

/**
 * Wrapper for Steps 2 & 3: manages the shared state of both.
 *
 * El paso 2 decide los tipos y qué papel juega cada columna; el 3 explora con
 * esas decisiones. Ambos permanecen montados (ocultos por CSS) para que ir y
 * volver no pierda ni la configuración ni los filtros del cuadro de mando.
 */
function DataWorkspace({
  dataset,
  hidden,
  fill,
}: {
  dataset: ParsedDataset;
  hidden: boolean;
  fill: boolean;
}) {
  const { step } = useWizard();
  const columnMapping = useColumnMapping(dataset);
  const analysis = useAnalysisConfig(columnMapping);

  // El cuadro de mando no se monta hasta que se llega a él: agregar el dataset
  // entero mientras el usuario sigue en el paso 2 sería trabajo tirado. Una vez
  // montado se queda, para no perder los filtros al ir y volver.
  const [dashboardMounted, setDashboardMounted] = useState(false);
  if (step === 3 && !dashboardMounted) setDashboardMounted(true);

  return (
    // La cadena de alturas: para que el cuadro de mando pueda medir «lo que
    // queda de ventana», cada envoltorio entre `main` y él tiene que ceder su
    // altura en vez de crecer con el contenido.
    <div
      className={cn(fill && 'xl:flex xl:min-h-0 xl:flex-1 xl:flex-col')}
      style={{ display: hidden ? 'none' : undefined }}
    >
      {/* Los tipos ocupan lo ancho —una tabla por columna— y la configuración
          del análisis es una columna de controles: en pantallas grandes caben
          lado a lado y el paso 2 deja de necesitar scroll. */}
      <div
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
        style={{ display: step === 2 ? undefined : 'none' }}
      >
        <ColumnMapper dataset={dataset} state={columnMapping} />
        <AnalysisSetup state={analysis} />
      </div>

      {dashboardMounted && (
        <div
          className={cn(fill && 'xl:min-h-0 xl:flex-1')}
          style={{ display: step === 3 ? undefined : 'none' }}
        >
          <AnalysisDashboard
            dataset={dataset}
            mapping={columnMapping}
            analysis={analysis}
          />
        </div>
      )}
    </div>
  );
}
