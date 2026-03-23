import { Download, RotateCcw } from 'lucide-react';
import { useEpisodeStore } from '../../store/episodeStore';
import { Button } from '../ui/Button';

export function DownloadPanel() {
  const output = useEpisodeStore((state) => state.output);
  const reset = useEpisodeStore((state) => state.reset);
  const setView = useEpisodeStore((state) => state.setView);
  const metadata = useEpisodeStore((state) => state.metadata);

  const handleDownloadAudio = () => {
    if (!output) return;
    const link = document.createElement('a');
    link.href = output.finalAudioUrl;
    link.download = `${metadata.title || 'satsang'}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadThumbnail = () => {
    if (!output) return;
    const link = document.createElement('a');
    link.href = output.thumbnailUrl;
    link.download = `${metadata.title || 'satsang'}-thumbnail.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNewEpisode = () => {
    reset();
    setView('landing');
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleDownloadAudio}
        variant="primary"
        size="lg"
        className="w-full flex items-center justify-center gap-2"
      >
        <Download className="w-5 h-5" />
        Download Episode (MP3)
      </Button>

      <Button
        onClick={handleDownloadThumbnail}
        variant="secondary"
        size="lg"
        className="w-full flex items-center justify-center gap-2"
      >
        <Download className="w-5 h-5" />
        Download Thumbnail
      </Button>

      <div className="h-px bg-satsang-sandalwood" />

      <Button
        onClick={handleNewEpisode}
        variant="outlined"
        size="lg"
        className="w-full flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-5 h-5" />
        Start New Episode
      </Button>
    </div>
  );
}
