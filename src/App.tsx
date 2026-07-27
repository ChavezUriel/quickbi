import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { useDataset } from '@/features/dataset/use-dataset'
import { ColumnMapper } from '@/features/mapping/components/column-mapper'
import { DatasetPreview } from '@/features/upload/components/dataset-preview'
import { FileUploader } from '@/features/upload/components/file-uploader'

function App() {
  const { dataset, setDataset, clearDataset } = useDataset()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 p-6 md:p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">QuickBI</h1>
          <p className="text-muted-foreground">
            Análisis exploratorio y BI 100% en el navegador. Tus datos nunca salen de tu
            máquina.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <FileUploader onDatasetParsed={setDataset} />

      {dataset && (
        <div className="space-y-4">
          <DatasetPreview dataset={dataset} />

          {/* `key` reinicia las correcciones de tipo y la selección al cargar
              otro fichero, en lugar de sincronizar estado con un efecto. */}
          <ColumnMapper key={`${dataset.fileName}:${dataset.rowCount}`} dataset={dataset} />

          <Button variant="outline" size="sm" onClick={clearDataset}>
            Descartar dataset
          </Button>
        </div>
      )}
    </main>
  )
}

export default App
