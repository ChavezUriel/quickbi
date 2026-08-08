import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWizard } from '../use-wizard';

export function StepNavigation() {
  const { step, goNext, goBack, canAdvance } = useWizard();

  return (
    <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
      {step > 1 ? (
        <Button variant="outline" onClick={goBack}>
          <ChevronLeft className="size-4" />
          Atrás
        </Button>
      ) : (
        <div />
      )}

      {step < 3 ? (
        <Button onClick={goNext} disabled={!canAdvance}>
          Siguiente
          <ChevronRight className="size-4" />
        </Button>
      ) : (
        <div />
      )}
    </div>
  );
}
