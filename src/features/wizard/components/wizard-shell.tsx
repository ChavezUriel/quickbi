import { AppShell, SHELL_CONTAINER } from '@/components/app-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParsedDataset } from '@/features/dataset/types';
import { useColumnMapping } from '@/features/mapping/use-column-mapping';
import { ColumnMapper } from '@/features/mapping/components/column-mapper';
import { datasetCapabilities } from '@/features/tools/capabilities';
import { ToolGallery } from '@/features/tools/components/tool-gallery';
import { availabilityOf, getTool } from '@/features/tools/registry';
import type { ToolDefinition } from '@/features/tools/types';
import { useMemo } from 'react';
import { useWizard } from '../use-wizard';
import { StepNavigation } from './step-navigation';
import { UploadStep } from './upload-step';
import { WizardHeader } from './wizard-header';

export function WizardShell() {
  const { step, composedDataset, toolId } = useWizard();
  const tool = getTool(toolId);

  // Solo el cuadro de mando de algunas herramientas quiere la ventana entera;
  // los demás pasos son documentos que crecen con su contenido y quieren scroll.
  const fill = step === 'cuadro' && tool?.fill === true;

  return (
    <AppShell fill={fill}>
      <WizardHeader />

      <main
        className={cn(
          SHELL_CONTAINER,
          'flex-1 py-4 sm:py-6',
          step !== 'cuadro' && 'pb-24 sm:pb-28',
          fill && '3xl:flex 3xl:min-h-0 3xl:flex-col 3xl:py-3',
        )}
      >
        {/* Paso 1: siempre montado, oculto cuando no es el activo. */}
        <div style={{ display: step === 'carga' ? undefined : 'none' }}>
          <UploadStep />
        </div>

        {/* El resto de pasos comparten el estado de mapeo vía DataWorkspace. */}
        {composedDataset && (
          <DataWorkspace
            key={composedDataset.id}
            dataset={composedDataset}
            fill={fill}
          />
        )}
      </main>

      {step !== 'cuadro' && <StepNavigation />}
    </AppShell>
  );
}

/**
 * Todo lo que ocurre después de la carga: los tipos, la elección de
 * herramienta y la herramienta misma.
 *
 * Los tipos viven aquí y no dentro de la herramienta porque son anteriores a
 * ella y las sobreviven: cambiar de herramienta no debería obligar a volver a
 * declarar que la columna «fecha_alta» es una fecha. Todos los paneles
 * permanecen montados, ocultos por CSS, para que ir y volver no pierda nada.
 */
function DataWorkspace({ dataset, fill }: { dataset: ParsedDataset; fill: boolean }) {
  const { step, toolId, setToolId, setToolReady } = useWizard();
  const mapping = useColumnMapping(dataset);
  const tool = getTool(toolId);

  const capabilities = useMemo(() => datasetCapabilities(mapping), [mapping]);

  return (
    // La cadena de alturas: para que el cuadro de mando pueda medir «lo que
    // queda de ventana», cada envoltorio entre `main` y él cede su altura en
    // vez de crecer con el contenido.
    <div className={cn(fill && '3xl:flex 3xl:min-h-0 3xl:flex-1 3xl:flex-col')}>
      <div style={{ display: step === 'tipos' ? undefined : 'none' }}>
        <ColumnMapper dataset={dataset} state={mapping} />
      </div>

      <div style={{ display: step === 'herramienta' ? undefined : 'none' }}>
        <ToolGallery
          capabilities={capabilities}
          selected={toolId}
          onSelect={setToolId}
        />
      </div>

      {tool !== null && (
        <ToolHost
          // Cambiar de herramienta desmonta la anterior: mantener dos cuadros
          // de mando vivos duplicaría en memoria el dataset preparado.
          key={tool.id}
          tool={tool}
          dataset={dataset}
          mapping={mapping}
          capabilities={capabilities}
          fill={fill}
          onReady={setToolReady}
        />
      )}
    </div>
  );
}

function ToolHost({
  tool,
  dataset,
  mapping,
  capabilities,
  fill,
  onReady,
}: {
  tool: ToolDefinition;
  dataset: ParsedDataset;
  mapping: ReturnType<typeof useColumnMapping>;
  capabilities: ReturnType<typeof datasetCapabilities>;
  fill: boolean;
  onReady: (ready: boolean) => void;
}) {
  const { step, goToStep } = useWizard();
  const active = step === 'configuracion' || step === 'cuadro';

  // Los tipos se pueden corregir después de elegir la herramienta, y esa
  // corrección puede dejarla sin lo que necesitaba. Es preferible decirlo a
  // pintar un cuadro de mando vacío sin explicación.
  const availability = availabilityOf(tool, capabilities);

  return (
    <div
      className={cn(fill && '3xl:flex 3xl:min-h-0 3xl:flex-1 3xl:flex-col')}
      style={{ display: active ? undefined : 'none' }}
    >
      {availability.available ? (
        <tool.Workspace
          dataset={dataset}
          mapping={mapping}
          view={step === 'cuadro' ? 'cuadro' : 'configuracion'}
          fill={fill}
          onReady={onReady}
        />
      ) : (
        <Alert role="status" className="mx-auto max-w-2xl">
          <TriangleAlert className="size-4" />
          <AlertTitle>{tool.label} ya no encaja con estos datos</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{availability.reason}</p>
            <Button variant="outline" size="sm" onClick={() => goToStep('herramienta')}>
              Elegir otra herramienta
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
