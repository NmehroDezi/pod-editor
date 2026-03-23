import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Textarea';
import { useEpisodeStore } from '../store/episodeStore';

export function ImagePromptView() {
  const metadata = useEpisodeStore((state) => state.metadata);
  const setMetadata = useEpisodeStore((state) => state.setMetadata);
  const setView = useEpisodeStore((state) => state.setView);

  const prompt = metadata.thumbnailPrompt;

  const handleGenerate = async () => {
    if (prompt.trim()) {
      // This will trigger the thumbnail generation in the processing view
      setView('image-result');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4 py-8">
      <div className="text-center max-w-2xl mb-4">
        <h1 className="text-4xl font-heading font-semibold text-satsang-bark mb-2">
          Generate Cover Image
        </h1>
        <p className="text-satsang-ash text-lg">
          Describe the artwork you'd like to generate
        </p>
      </div>

      <div className="max-w-2xl w-full space-y-6">
        <div>
          <label className="block text-sm font-medium text-satsang-bark mb-2">
            Image Prompt *
          </label>
          <Textarea
            placeholder="Describe your podcast cover. E.g., 'Swami ji seated in meditation by the Ganges at dawn, saffron robes, golden light, Sanskrit elements'"
            value={prompt}
            onChange={(e) => setMetadata({ thumbnailPrompt: e.target.value })}
            rows={6}
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim()}
          variant="primary"
          size="lg"
          className="w-full"
        >
          ✨ Generate Image
        </Button>

        <Button
          onClick={() => setView('dashboard')}
          variant="outlined"
          size="md"
          className="w-full"
        >
          ← Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
