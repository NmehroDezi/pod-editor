import { DropZone } from '../components/upload/DropZone';
import { FileList } from '../components/upload/FileList';
import { MetadataForm } from '../components/upload/MetadataForm';
import { Button } from '../components/ui/Button';
import { useEpisodeStore } from '../store/episodeStore';

export function AudioUploadView() {
  const setView = useEpisodeStore((state) => state.setView);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-satsang-bark mb-2">
            Upload Your Audio
          </h1>
          <p className="text-satsang-ash">
            Select your MP3 files and arrange them in the order they should be stitched.
          </p>
        </div>

        <DropZone />
        <FileList />

        <Button
          onClick={() => setView('dashboard')}
          variant="outlined"
          size="md"
        >
          ← Back to Dashboard
        </Button>
      </div>

      <div className="lg:col-span-1">
        <MetadataForm submitLabel="Process Audio" onSubmit={() => setView('audio-processing')} />
      </div>
    </div>
  );
}
