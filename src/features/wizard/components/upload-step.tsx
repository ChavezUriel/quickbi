import { Columns3, FileUp, LayoutGrid } from 'lucide-react';
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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="grid items-stretch gap-4 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
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
        <div className="space-y-6">
          <DatasetReadiness dataset={composedDataset} />
          <DatasetPreview
            dataset={composedDataset}
            sourceFileCount={
              schemaGroups.find((g) => g.fingerprint === selectedFingerprint)
                ?.datasetIds.length
            }
          />
        </div>
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
    title: 'Confirma los tipos',
    text: 'Revisa qué es número, qué es fecha y qué es categoría.',
  },
  {
    icon: LayoutGrid,
    title: 'Elige la herramienta',
    text: 'Perfil, tabla dinámica, análisis cruzado, RFM o un gráfico a medida.',
  },
];

function EmptyState({
  onDatasetParsed,
}: {
  onDatasetParsed: React.ComponentProps<typeof FileUploader>['onDatasetParsed'];
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col justify-center gap-8 py-6 sm:py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Análisis exploratorio de tus datos, sin subirlos a ningún sitio
        </h1>
        <p className="mx-auto max-w-xl text-sm text-pretty text-muted-foreground sm:text-base">
          Sube una hoja de cálculo y QuickBI la explora al instante. Todo el
          procesamiento ocurre en esta pestaña: tus datos nunca salen de tu máquina.
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl">
        <FileUploader onDatasetParsed={onDatasetParsed} />
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {HOW_IT_WORKS.map(({ icon: Icon, title, text }, index) => (
          <li
            key={title}
            className="space-y-2 rounded-xl border border-border/80 bg-card p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
          >
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden />
              </div>
              <span className="text-xs font-semibold tracking-tight text-foreground">
                {index + 1}. {title}
              </span>
            </div>
            <p className="text-xs text-pretty text-muted-foreground leading-relaxed pl-9">
              {text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
