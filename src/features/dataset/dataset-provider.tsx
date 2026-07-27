import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { DatasetContext, type DatasetStore } from './dataset-context';
import type { ParsedDataset } from './types';

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);

  const clearDataset = useCallback(() => setDataset(null), []);

  const store = useMemo<DatasetStore>(
    () => ({ dataset, setDataset, clearDataset }),
    [dataset, clearDataset],
  );

  return <DatasetContext value={store}>{children}</DatasetContext>;
}
