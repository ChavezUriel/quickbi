import { useContext } from 'react';
import { DatasetContext, type DatasetStore } from './dataset-context';

/** Acceso al dataset activo. Falla ruidosamente fuera del provider. */
export function useDataset(): DatasetStore {
  const store = useContext(DatasetContext);

  if (!store) {
    throw new Error('useDataset debe usarse dentro de un <DatasetProvider>.');
  }

  return store;
}
