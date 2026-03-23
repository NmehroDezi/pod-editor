import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useEpisodeStore } from '../store/episodeStore';
import { runStepMixing, getMusicOptions } from '../lib/api';
import type { MusicTrack } from '../types/episode';

export function MusicSelectView() {
  const setView = useEpisodeStore((state) => state.setView);
  const setSelectedMusicTrack = useEpisodeStore((state) => state.setSelectedMusicTrack);
  const jobId = useEpisodeStore((state) => state.jobId);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [musicLibrary, setMusicLibrary] = useState<MusicTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);

  // Fetch available music tracks on mount
  useEffect(() => {
    const fetchMusicOptions = async () => {
      try {
        const options = await getMusicOptions();
        setMusicLibrary(options);
      } catch (err) {
        console.error('Failed to load music options:', err);
        setMusicLibrary([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMusicOptions();
  }, []);

  const filteredMusic = musicLibrary.filter(
    (track) =>
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectTrack = (track: MusicTrack) => {
    setSelectedTrack(track);
  };

  const handleConfirmMusic = async () => {
    if (!selectedTrack || !jobId) return;
    setSelectedMusicTrack(selectedTrack);
    try {
      await runStepMixing(jobId, selectedTrack.filename);
      setView('music-processing');
    } catch (err) {
      console.error('Error starting music mixing:', err);
    }
  };

  const handleUploadMusic = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const customTrack: MusicTrack = {
          id: 'custom-' + Date.now(),
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'Your Upload',
          source: 'upload',
        };
        setSelectedTrack(customTrack);
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4 py-8">
      <div className="text-center max-w-2xl mb-4">
        <h1 className="text-4xl font-heading font-semibold text-satsang-bark mb-2">
          Choose Background Music
        </h1>
        <p className="text-satsang-ash text-lg">
          Search from royalty-free music or upload your own
        </p>
      </div>

      <div className="max-w-2xl w-full space-y-6">
        {!selectedTrack ? (
          <>
            <Input
              label="Search Music"
              placeholder="e.g., peaceful, meditation, spiritual..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Music Results */}
            {!showUpload && (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="p-4 text-center text-satsang-ash">
                    Loading music options...
                  </div>
                ) : filteredMusic.length > 0 ? (
                  <>
                    {filteredMusic.map((track) => (
                      <button
                        key={track.id}
                        onClick={() => handleSelectTrack(track)}
                        className="w-full p-4 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood transition-all duration-200 hover:bg-satsang-sandalwood hover:shadow-lg text-left"
                      >
                        <h3 className="font-semibold text-satsang-bark">{track.title}</h3>
                        <p className="text-sm text-satsang-ash">by {track.artist}</p>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="p-4 text-center text-satsang-ash">
                    {musicLibrary.length === 0 ? 'No music available' : `No music found matching "${searchQuery}"`}
                  </div>
                )}
              </div>
            )}

            {/* Upload Section */}
            {showUpload && (
              <div className="p-6 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood text-center">
                <h3 className="font-semibold text-satsang-bark mb-4">Upload Your Music</h3>
                <Button
                  onClick={handleUploadMusic}
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  Choose Audio File
                </Button>
              </div>
            )}

            {/* Toggle Upload / Search */}
            <Button
              onClick={() => setShowUpload(!showUpload)}
              variant="outlined"
              size="md"
              className="w-full"
            >
              {showUpload ? '← Back to Search' : 'Upload Your Own →'}
            </Button>
          </>
        ) : (
          <>
            {/* Confirmation Section */}
            <div className="p-6 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood text-center">
              <h2 className="text-2xl font-semibold text-satsang-bark mb-4">Confirm Selection</h2>
              <div className="mb-6">
                <h3 className="font-semibold text-satsang-bark text-lg">{selectedTrack.title}</h3>
                <p className="text-satsang-ash">by {selectedTrack.artist}</p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={handleConfirmMusic}
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  ✓ Add Music
                </Button>
                <Button
                  onClick={() => setSelectedTrack(null)}
                  variant="outlined"
                  size="md"
                  className="w-full"
                >
                  ← Choose Different Track
                </Button>
              </div>
            </div>
          </>
        )}

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
