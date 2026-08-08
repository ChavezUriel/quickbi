import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  WizardContext,
  type SchemaGroup,
  type WizardStep,
  type WizardStore,
} from './wizard-context';
import type { ParsedDataset } from '@/features/dataset/types';
import {
  getSchemaFingerprint,
  mergeDatasets,
} from '@/features/upload/lib/merge-datasets';

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [datasets, setDatasets] = useState<ParsedDataset[]>([]);
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(null);

  // Derive schema groups from datasets
  const schemaGroups = useMemo<SchemaGroup[]>(() => {
    const groupMap = new Map<string, { columnNames: string[]; datasetIds: string[] }>();

    for (const dataset of datasets) {
      const fingerprint = getSchemaFingerprint(dataset);
      const existing = groupMap.get(fingerprint);
      if (existing) {
        existing.datasetIds.push(dataset.id);
      } else {
        groupMap.set(fingerprint, {
          columnNames: dataset.columns.map((c) => c.name),
          datasetIds: [dataset.id],
        });
      }
    }

    return Array.from(groupMap.entries()).map(
      ([fingerprint, { columnNames, datasetIds }]) => ({
        fingerprint,
        columnNames,
        datasetIds,
      }),
    );
  }, [datasets]);

  // Auto-select when there's exactly one schema group
  useEffect(() => {
    if (schemaGroups.length === 1) {
      const firstGroup = schemaGroups[0];
      if (firstGroup) {
        setSelectedFingerprint(firstGroup.fingerprint);
      }
    } else if (schemaGroups.length === 0) {
      setSelectedFingerprint(null);
    }
  }, [schemaGroups]);

  // Derive composed dataset
  const composedDataset = useMemo<ParsedDataset | null>(() => {
    if (selectedFingerprint === null || datasets.length === 0) return null;

    const selectedGroup = schemaGroups.find((g) => g.fingerprint === selectedFingerprint);
    if (!selectedGroup) return null;

    const matchingDatasets = datasets.filter((d) =>
      selectedGroup.datasetIds.includes(d.id),
    );
    if (matchingDatasets.length === 0) return null;

    return mergeDatasets(matchingDatasets);
  }, [datasets, selectedFingerprint, schemaGroups]);

  const canAdvance = useMemo<boolean>(() => {
    switch (step) {
      case 1:
        return selectedFingerprint !== null && composedDataset !== null;
      case 2:
        return composedDataset !== null;
      case 3:
        return false;
    }
  }, [step, selectedFingerprint, composedDataset]);

  const goNext = useCallback(() => {
    setStep((s) => (s < 3 ? ((s + 1) as WizardStep) : s));
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }, []);

  const goToStep = useCallback(
    (target: WizardStep) => {
      if (target < step || (target === step + 1 && canAdvance)) {
        setStep(target);
      }
    },
    [step, canAdvance],
  );

  const addDataset = useCallback((dataset: ParsedDataset) => {
    setDatasets((prev) => [...prev, dataset]);
  }, []);

  const removeDataset = useCallback((id: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const store = useMemo<WizardStore>(
    () => ({
      step,
      goNext,
      goBack,
      goToStep,
      datasets,
      schemaGroups,
      selectedFingerprint,
      composedDataset,
      canAdvance,
      addDataset,
      removeDataset,
      setSelectedFingerprint,
    }),
    [
      step,
      goNext,
      goBack,
      goToStep,
      datasets,
      schemaGroups,
      selectedFingerprint,
      composedDataset,
      canAdvance,
      addDataset,
      removeDataset,
    ],
  );

  return <WizardContext.Provider value={store}>{children}</WizardContext.Provider>;
}
