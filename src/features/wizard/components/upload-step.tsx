import { useWizard } from '../use-wizard';
import { FileUploader } from '@/features/upload/components/file-uploader';
import { FileList } from '@/features/upload/components/file-list';
import { DatasetPreview } from '@/features/upload/components/dataset-preview';

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

  return (
    <div className="space-y-6">
      <FileUploader onDatasetParsed={addDataset} />
      {datasets.length > 0 && (
        <FileList
          datasets={datasets}
          schemaGroups={schemaGroups}
          selectedFingerprint={selectedFingerprint}
          onSelectFingerprint={(fp) => setSelectedFingerprint(fp)}
          onRemoveDataset={removeDataset}
        />
      )}
      {composedDataset && (
        <DatasetPreview
          dataset={composedDataset}
          sourceFileCount={
            schemaGroups.find((g) => g.fingerprint === selectedFingerprint)
              ?.datasetIds.length
          }
        />
      )}
    </div>
  );
}
