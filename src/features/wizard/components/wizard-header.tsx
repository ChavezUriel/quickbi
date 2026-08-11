import { ChartNoAxesCombined, Lock } from 'lucide-react';
import { HEADER_HEIGHT, SHELL_CONTAINER, StickyBar } from '@/components/app-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { StepIndicator } from './step-indicator';

/**
 * Barra superior fija: marca, progreso y ajustes.
 *
 * Va pegada porque el progreso deja de ser útil justo cuando se pierde de
 * vista: en el paso 3 la página mide varias pantallas y saber dónde se está
 * —y poder volver— no puede depender de subir del todo.
 */
export function WizardHeader() {
  return (
    <StickyBar side="top">
      <div
        className={cn(
          SHELL_CONTAINER,
          HEADER_HEIGHT,
          'grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6',
        )}
      >
        <div className="flex items-center gap-2 justify-self-start">
          <ChartNoAxesCombined className="size-5 text-primary" aria-hidden />
          <span className="text-base font-semibold tracking-tight">QuickBI</span>
        </div>

        <div className="flex min-w-0 justify-self-center">
          <StepIndicator />
        </div>

        <div className="flex items-center gap-2 justify-self-end sm:gap-3">
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

