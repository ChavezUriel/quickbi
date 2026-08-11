import { Columns3, FileUp, Rows3 } from 'lucide-react';
import { useWizard } from '../use-wizard';
import { FileUploader } from '@/features/upload/components/file-uploader';
import { FileList } from '@/features/upload/components/file-list';
import { DatasetPreview } from '@/features/upload/components/dataset-preview';
import { DatasetReadiness } from '@/features/analysis/components/dataset-readiness';

export function UploadStep() {
  const {
    addDataset,
    datasets,
    schemaGroups,
    selectedFingerprint,
    setSelectedFingerprint,
    removeDataset,
    composedDataset,
  } = useWizard();

  // Pantalla vacía: no hay nada que enseñar, así que la zona de carga se queda
  // con toda la ventana y con el único mensaje que importa.
  if (datasets.length === 0) {
    return <EmptyState onDatasetParsed={addDataset} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid items-stretch gap-4 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr]">
        <FileUploader onDatasetParsed={addDataset} compact />
        <FileList
          datasets={datasets}
          schemaGroups={schemaGroups}
          selectedFingerprint={selectedFingerprint}
          onSelectFingerprint={(fp) => setSelectedFingerprint(fp)}
          onRemoveDataset={removeDataset}
        />
      </div>

      {composedDataset && (
        <>
          <DatasetReadiness dataset={composedDataset} />
          <DatasetPreview
            dataset={composedDataset}
            sourceFileCount={
              schemaGroups.find((g) => g.fingerprint === selectedFingerprint)
                ?.datasetIds.length
            }
          />
        </>
      )}
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    icon: FileUp,
    title: 'Carga los archivos',
    text: 'CSV o Excel, uno o varios. Los que compartan columnas se combinan solos.',
  },
  {
    icon: Columns3,
    title: 'Confirma los campos',
    text: 'Revisa los tipos detectados y elige qué medir y por qué agrupar.',
  },
  {
    icon: Rows3,
    title: 'Cruza y compara',
    text: 'Evolución, subidas y caídas, y el detalle exacto, todo filtrado a la vez.',
  },
];

function EmptyState({
  onDatasetParsed,
}: {
  onDatasetParsed: React.ComponentProps<typeof FileUploader>['onDatasetParsed'];
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col justify-center gap-8 py-4 sm:py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Análisis exploratorio de tus datos, sin subirlos a ningún sitio
        </h1>
        <p className="mx-auto max-w-xl text-sm text-pretty text-muted-foreground sm:text-base">
          Sube una hoja de cálculo y QuickBI la explora al instante. Todo el
          procesamiento ocurre en esta pestaña: tus datos nunca salen de tu máquina.
        </p>
      </div>

      <div className="mx-auto w-full max-w-lg">
        <FileUploader onDatasetParsed={onDatasetParsed} />
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {HOW_IT_WORKS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="space-y-1.5 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium">
                {index + 1}. {title}
              </span>
            </div>
            <p className="text-xs text-pretty text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
