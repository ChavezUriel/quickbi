import { createContext } from 'react';
import type { ParsedDataset } from '@/features/dataset/types';

export type WizardStep = 1 | 2 | 3;

export const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Carga de archivos',
  2: 'Configuración de campos',
  3: 'Análisis cruzado',
};

export interface SchemaGroup {
  fingerprint: string;
  columnNames: string[];
  datasetIds: string[];
}

export interface WizardStore {
  step: WizardStep;
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: WizardStep) => void;

  datasets: ParsedDataset[];
  schemaGroups: SchemaGroup[];
  selectedFingerprint: string | null;
  composedDataset: ParsedDataset | null;
  canAdvance: boolean;

  addDataset: (dataset: ParsedDataset) => void;
  removeDataset: (id: string) => void;
  setSelectedFingerprint: (fingerprint: string | null) => void;
}

export const WizardContext = createContext<WizardStore | null>(null);
