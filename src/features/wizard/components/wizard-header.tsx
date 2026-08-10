import { ChartNoAxesCombined, Lock } from 'lucide-react';
import { HEADER_HEIGHT, SHELL_CONTAINER, StickyBar } from '@/components/app-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { useWizard } from '../use-wizard';
import { StepIndicator } from './step-indicator';

/**
 * Barra superior fija: marca, progreso y ajustes.
 *
 * Va pegada porque el progreso deja de ser útil justo cuando se pierde de
 * vista: en el paso 3 la página mide varias pantallas y saber dónde se está
 * —y poder volver— no puede depender de subir del todo.
 */
export function WizardHeader() {
  const { composedDataset } = useWizard();

  return (
    <StickyBar side="top">
      <div className={cn(SHELL_CONTAINER, HEADER_HEIGHT, 'flex items-center gap-3 sm:gap-6')}>
        <div className="flex shrink-0 items-center gap-2">
          <ChartNoAxesCombined className="size-5 text-primary" aria-hidden />
          <span className="text-base font-semibold tracking-tight">QuickBI</span>
        </div>

        <div className="flex min-w-0 flex-1 justify-start sm:justify-center">
          <StepIndicator />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {composedDataset !== null && (
            <span className="hidden max-w-56 items-center gap-1.5 text-xs text-muted-foreground xl:inline-flex">
              <span className="truncate font-mono" title={composedDataset.fileName}>
                {composedDataset.fileName}
              </span>
              <span className="shrink-0 tabular-nums">
                · {composedDataset.rowCount.toLocaleString('es-ES')} filas
              </span>
            </span>
          )}

          <span className="hidden items-center gap-1 text-xs text-muted-foreground 2xl:inline-flex">
            <Lock className="size-3" aria-hidden />
            Todo ocurre en tu navegador
          </span>

          <ThemeToggle />
        </div>
      </div>
    </StickyBar>
  );
}
