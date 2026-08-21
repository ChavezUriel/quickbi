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
import { getTool } from '@/features/tools/registry';

/** Los pasos que existen siempre, antes de saber qué herramienta se elige. */
const BASE_STEPS: WizardStepId[] = ['carga', 'tipos', 'herramienta'];

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<WizardStepId>('carga');
  const [datasets, setDatasets] = useState<ParsedDataset[]>([]);
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(null);
  const [toolId, setToolIdState] = useState<string | null>(null);
  const [toolReady, setToolReady] = useState(false);

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

  const tool = getTool(toolId);

  // La secuencia depende de la herramienta: la que no pregunta nada no gana un
  // paso de configuración vacío.
  const steps = useMemo<WizardStepId[]>(() => {
    if (tool === null) return BASE_STEPS;
    return tool.hasSetup
      ? [...BASE_STEPS, 'configuracion', 'cuadro']
      : [...BASE_STEPS, 'cuadro'];
  }, [tool]);

  const stepLabels = useMemo<Record<WizardStepId, string>>(
    () => ({ ...STEP_LABELS, cuadro: tool?.label ?? STEP_LABELS.cuadro }),
    [tool],
  );

  const canAdvance = useMemo<boolean>(() => {
    switch (step) {
      case 'carga':
        return selectedFingerprint !== null && composedDataset !== null;
      case 'tipos':
        return composedDataset !== null;
      case 'herramienta':
        return tool !== null;
      case 'configuracion':
        return toolReady;
      case 'cuadro':
        return false;
    }
  }, [step, selectedFingerprint, composedDataset, tool, toolReady]);

  // Cambiar de herramienta puede acortar la secuencia por debajo del paso
  // actual; si eso pasa, el asistente retrocede al último paso que sigue
  // existiendo en vez de quedarse en un paso que ya no está.
  useEffect(() => {
    if (!steps.includes(step)) {
      setStep(steps[steps.length - 1] ?? 'carga');
    }
  }, [steps, step]);

  const goNext = useCallback(() => {
    setStep((current) => {
      const index = steps.indexOf(current);
      return steps[index + 1] ?? current;
    });
  }, [steps]);

  const goBack = useCallback(() => {
    setStep((current) => {
      const index = steps.indexOf(current);
      return index > 0 ? (steps[index - 1] ?? current) : current;
    });
  }, [steps]);

  const goToStep = useCallback(
    (target: WizardStepId) => {
      const targetIndex = steps.indexOf(target);
      const currentIndex = steps.indexOf(step);
      if (targetIndex < 0 || currentIndex < 0) return;

      // Se puede volver a cualquier paso ya visitado, y avanzar solo al
      // siguiente, y solo si el actual está resuelto.
      if (targetIndex < currentIndex || (targetIndex === currentIndex + 1 && canAdvance)) {
        setStep(target);
      }
    },
    [steps, step, canAdvance],
  );

  const addDataset = useCallback((dataset: ParsedDataset) => {
    setDatasets((prev) => [...prev, dataset]);
  }, []);

  const removeDataset = useCallback((id: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const setToolId = useCallback((id: string | null) => {
    setToolIdState(id);
    // La validez es de la herramienta anterior: la nueva la comunicará al
    // montarse, y hasta entonces no hay nada resuelto que dar por bueno.
    setToolReady(false);
  }, []);

  const store = useMemo<WizardStore>(
    () => ({
      step,
      steps,
      stepLabels,
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
      toolId,
      setToolId,
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
      datasets,
      schemaGroups,
      selectedFingerprint,
      composedDataset,
      canAdvance,
      addDataset,
      removeDataset,
      toolId,
      setToolId,
      toolReady,
    ],
  );

  return <WizardContext.Provider value={store}>{children}</WizardContext.Provider>;
}
