import { useEpisodeStore } from '../../store/episodeStore';
import { runStepCleanup } from '../../lib/api';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

interface MetadataFormProps {
  submitLabel?: string;
  onSubmit?: () => void;
}

export function MetadataForm({ submitLabel = 'Begin Processing', onSubmit }: MetadataFormProps) {
  const metadata = useEpisodeStore((state) => state.metadata);
  const files = useEpisodeStore((state) => state.files);
  const setMetadata = useEpisodeStore((state) => state.setMetadata);
  const startProcessing = useEpisodeStore((state) => state.startProcessing);
  const setView = useEpisodeStore((state) => state.setView);

  const isFormValid = metadata.title.trim().length > 0 && files.length > 0;

  const handleStartProcessing = async () => {
    if (isFormValid) {
      await startProcessing();
      const state = useEpisodeStore.getState();
      if (state.jobId) {
        await runStepCleanup(state.jobId);
      }
      if (onSubmit) {
        onSubmit();
      } else {
        setView('audio-processing');
      }
    }
  };

  return (
    <div className="sticky top-8 space-y-6">
      <h2 className="text-xl font-semibold text-satsang-bark">
        Episode Details
      </h2>

      <Input
        label="Episode Title *"
        placeholder="e.g., The Path of Bhakti"
        value={metadata.title}
        onChange={(e) => setMetadata({ title: e.target.value })}
        required
      />

      <Textarea
        label="Episode Description"
        placeholder="A brief description of this episode..."
        value={metadata.description}
        onChange={(e) => setMetadata({ description: e.target.value })}
        rows={4}
      />

      {/* High contrast button - always visible */}
      <div className="pt-4 border-t-2 border-satsang-sandalwood">
        <Button
          onClick={handleStartProcessing}
          disabled={!isFormValid}
          size="lg"
          className="w-full !bg-satsang-saffron !text-black font-bold shadow-lg text-base"
        >
          ✨ {submitLabel}
        </Button>
      </div>

      {/* Status message */}
      {!isFormValid && (
        <div className="p-3 rounded-lg bg-satsang-parchment border border-satsang-sandalwood">
          <p className="text-sm text-satsang-bark text-center font-medium">
            {files.length === 0
              ? '📁 Upload at least one MP3 file to continue'
              : '📝 Enter an episode title to continue'}
          </p>
        </div>
      )}

      {isFormValid && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700 text-center font-medium">
            ✅ Ready to process! Click the button above.
          </p>
        </div>
      )}
    </div>
  );
}
