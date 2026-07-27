import { useState } from 'react'
import { DatasetPreview } from '@/features/upload/components/dataset-preview'
import { FileUploader } from '@/features/upload/components/file-uploader'
import type { ParsedDataset } from '@/features/upload/types'

function App() {
  const [dataset, setDataset] = useState<ParsedDataset | null>(null)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 p-6 md:p-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">QuickBI</h1>
        <p className="text-muted-foreground">
          Análisis exploratorio y BI 100% en el navegador. Tus datos nunca salen de tu máquina.
        </p>
      </header>

      <FileUploader onDatasetParsed={setDataset} />

      {dataset && <DatasetPreview dataset={dataset} />}
    </main>
  )
}

export default App
