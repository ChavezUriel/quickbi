import { createContext } from 'react';
import type { ParsedDataset } from '@/features/dataset/types';

/**
 * Los pasos del asistente se identifican por nombre y no por número porque la
 * secuencia ya no es fija: una herramienta que no tiene nada que configurar
 * —el perfil de datos— se salta ese paso, y numerarlos obligaría a renumerar
 * todo lo que hay detrás. El número que se ve es su posición en la secuencia
 * vigente, y se calcula al pintarlo.
 */
export type WizardStepId =
  | 'carga'
  | 'tipos'
  | 'herramienta'
  | 'configuracion'
  | 'cuadro';

export const STEP_LABELS: Record<WizardStepId, string> = {
  carga: 'Carga de archivos',
  tipos: 'Tipos de campos',
  herramienta: 'Herramienta',
  configuracion: 'Configuración',
  cuadro: 'Análisis',
};

export interface SchemaGroup {
  fingerprint: string;
  columnNames: string[];
  datasetIds: string[];
}

export interface WizardStore {
  step: WizardStepId;
  /** Secuencia vigente; depende de la herramienta elegida. */
  steps: WizardStepId[];
  /** Rótulo de cada paso, con el nombre de la herramienta ya sustituido. */
  stepLabels: Record<WizardStepId, string>;
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: WizardStepId) => void;

  datasets: ParsedDataset[];
  schemaGroups: SchemaGroup[];
  selectedFingerprint: string | null;
  composedDataset: ParsedDataset | null;
  canAdvance: boolean;

  addDataset: (dataset: ParsedDataset) => void;
  removeDataset: (id: string) => void;
  setSelectedFingerprint: (fingerprint: string | null) => void;

  /** Herramienta de análisis elegida en el paso 3. */
  toolId: string | null;
  setToolId: (id: string | null) => void;
  /**
   * La herramienta dice si su configuración basta para pintar el cuadro de
   * mando. Es lo único que el asistente no puede saber por sí mismo: cada
   * herramienta pide columnas distintas.
   */
  toolReady: boolean;
  setToolReady: (ready: boolean) => void;
}

export const WizardContext = createContext<WizardStore | null>(null);
