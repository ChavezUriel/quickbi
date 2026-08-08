import type { ParsedDataset } from '@/features/dataset/types';
import { useColumnMapping } from '@/features/mapping/use-column-mapping';
import { ColumnMapper } from '@/features/mapping/components/column-mapper';
import { ChartView } from '@/features/chart/components/chart-view';
import { useWizard } from '../use-wizard';
import { StepIndicator } from './step-indicator';
import { StepNavigation } from './step-navigation';
import { UploadStep } from './upload-step';

export function WizardShell() {
  const { step, composedDataset } = useWizard();

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator />

      <div className="min-h-0 flex-1">
        {/* Step 1: always mounted, hidden when not active */}
        <div style={{ display: step === 1 ? undefined : 'none' }}>
          <UploadStep />
        </div>

        {/* Steps 2 & 3: share column mapping state via DataWorkspace */}
        {composedDataset && (
          <DataWorkspace
            key={composedDataset.id}
            dataset={composedDataset}
            hidden={step < 2}
          />
        )}
      </div>

      <StepNavigation />
    </div>
  );
}

/**
 * Wrapper for Steps 2 & 3: manages shared column mapping state.
 * Stays mounted (hidden via CSS) so that navigating between steps
 * preserves all user selections.
 */
function DataWorkspace({
  dataset,
  hidden,
}: {
  dataset: ParsedDataset;
  hidden: boolean;
}) {
  const { step } = useWizard();
  const columnMapping = useColumnMapping(dataset);

  return (
    <div style={{ display: hidden ? 'none' : undefined }}>
      <div style={{ display: step === 2 ? undefined : 'none' }}>
        <ColumnMapper dataset={dataset} state={columnMapping} />
      </div>
      <div style={{ display: step === 3 ? undefined : 'none' }}>
        <ChartView dataset={dataset} state={columnMapping} />
      </div>
    </div>
  );
}
