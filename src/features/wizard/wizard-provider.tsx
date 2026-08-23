import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  STEP_LABELS,
  WizardContext,
  type SchemaGroup,
  type WizardStepId,
  type WizardStore,
} from './wizard-context';
import type { ParsedDataset } from '@/features/dataset/types';
import {
  getSchemaFingerprint,
  mergeDatasets,
} from '@/features/upload/lib/merge-datasets';

const STEPS: WizardStepId[] = ['carga', 'tipos', 'herramienta'];

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<WizardStepId>('carga');
  const [datasets, setDatasets] = useState<ParsedDataset[]>([]);
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(null);
  const [toolId, setToolIdState] = useState<string | null>(null);
  const [toolReady, setToolReady] = useState(false);
  const [mappingReady, setMappingReady] = useState(true);

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

  const steps = STEPS;
  const stepLabels = STEP_LABELS;

  // Reset mapping readiness when the dataset changes
  useEffect(() => {
    setMappingReady(true);
  }, [composedDataset]);

  const canAdvance = useMemo<boolean>(() => {
    switch (step) {
      case 'carga':
        return selectedFingerprint !== null && composedDataset !== null;
      case 'tipos':
        return composedDataset !== null && mappingReady;
      case 'herramienta':
        return false;
    }
  }, [step, selectedFingerprint, composedDataset, mappingReady]);

  const canGoToStep = useCallback(
    (target: WizardStepId): boolean => {
      switch (target) {
        case 'carga':
          return true;
        case 'tipos':
          return selectedFingerprint !== null && composedDataset !== null;
        case 'herramienta':
          return composedDataset !== null && mappingReady;
      }
    },
    [selectedFingerprint, composedDataset, mappingReady],
  );

  const goToStep = useCallback(
    (target: WizardStepId) => {
      if (!canGoToStep(target)) return;
      setToolIdState(null);
      setStep(target);
    },
    [canGoToStep],
  );

  const goNext = useCallback(() => {
    setStep((current) => {
      const index = steps.indexOf(current);
      const next = steps[index + 1];
      if (next && canGoToStep(next)) {
        setToolIdState(null);
        return next;
      }
      return current;
    });
  }, [steps, canGoToStep]);

  const goBack = useCallback(() => {
    if (step === 'herramienta' && toolId !== null) {
      setToolIdState(null);
      return;
    }
    setStep((current) => {
      const index = steps.indexOf(current);
      return index > 0 ? (steps[index - 1] ?? current) : current;
    });
  }, [step, toolId, steps]);

  const addDataset = useCallback((dataset: ParsedDataset) => {
    setDatasets((prev) => [...prev, dataset]);
  }, []);

  const removeDataset = useCallback((id: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const setToolId = useCallback((id: string | null) => {
    setToolIdState(id);
    setToolReady(false);
  }, []);

  const selectTool = useCallback((id: string) => {
    setToolIdState(id);
    setToolReady(false);
    setStep('herramienta');
  }, []);

  const store = useMemo<WizardStore>(
    () => ({
      step,
      steps,
      stepLabels,
      goNext,
      goBack,
      goToStep,
      canGoToStep,
      datasets,
      schemaGroups,
      selectedFingerprint,
      composedDataset,
      canAdvance,
      addDataset,
      removeDataset,
      setSelectedFingerprint,
      mappingReady,
      setMappingReady,
      toolId,
      setToolId,
      selectTool,
      toolReady,
      setToolReady,
    }),
    [
      step,
      steps,
      stepLabels,
      goNext,
      goBack,
      goToStep,
      canGoToStep,
      datasets,
      schemaGroups,
      selectedFingerprint,
      composedDataset,
      canAdvance,
      addDataset,
      removeDataset,
      mappingReady,
      toolId,
      setToolId,
      selectTool,
      toolReady,
    ],
  );

  return <WizardContext.Provider value={store}>{children}</WizardContext.Provider>;
}
