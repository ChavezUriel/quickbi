import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWizard } from '../use-wizard';
import { STEP_LABELS, type WizardStep } from '../wizard-context';

const STEPS: WizardStep[] = [1, 2, 3];

export function StepIndicator() {
  const { step, goToStep } = useWizard();

  return (
    <nav aria-label="Progreso del asistente" className="mb-2">
      <ol className="flex items-center justify-center gap-0">
        {STEPS.map((s, index) => {
          const isCompleted = s < step;
          const isCurrent = s === step;
          const isFuture = s > step;

          return (
            <li key={s} className="flex items-center">
              {/* Step circle + label */}
              <button
                type="button"
                disabled={isFuture}
                onClick={() => goToStep(s)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'group flex flex-col items-center gap-1.5',
                  isFuture ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-200',
                    isCompleted &&
                      'border-primary bg-primary text-primary-foreground',
                    isCurrent &&
                      'border-primary bg-primary/10 text-primary ring-2 ring-primary/20',
                    isFuture &&
                      'border-muted-foreground/30 text-muted-foreground',
                  )}
                >
                  {isCompleted ? <Check className="size-4" /> : s}
                </span>
                <span
                  className={cn(
                    'hidden text-xs font-medium sm:block',
                    isCurrent && 'text-foreground',
                    isCompleted && 'text-muted-foreground',
                    isFuture && 'text-muted-foreground/50',
                  )}
                >
                  {STEP_LABELS[s]}
                </span>
              </button>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-3 h-0.5 w-12 rounded-full transition-colors duration-200 sm:w-20',
                    s < step ? 'bg-primary' : 'bg-muted-foreground/20',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
