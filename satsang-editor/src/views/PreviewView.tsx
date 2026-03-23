import { useEffect, useState } from 'react';
import { WaveformPlayer } from '../components/preview/WaveformPlayer';
import { ThumbnailDisplay } from '../components/preview/ThumbnailDisplay';
import { EpisodeCard } from '../components/preview/EpisodeCard';
import { DownloadPanel } from '../components/preview/DownloadPanel';
import { useEpisodeStore } from '../store/episodeStore';
import { getJobFiles, type JobFile } from '../lib/api';
import { Button } from '../components/ui/Button';

export function PreviewView() {
  const jobId = useEpisodeStore((state) => state.jobId);
  const setView = useEpisodeStore((state) => state.setView);
  const [files, setFiles] = useState<JobFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    setLoading(true);
    getJobFiles(jobId)
      .then((jobFiles) => {
        setFiles(jobFiles);
      })
      .catch((err) => {
        console.error('Failed to fetch job files:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [jobId]);

  const downloadFile = (fileName: string) => {
    if (!jobId) return;
    const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
    const url = `${API_BASE}/jobs/${jobId}/files/${fileName}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Audio Player & Episode Card */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-satsang-bark mb-2">
            Preview & Download
          </h1>
          <p className="text-satsang-ash">
            Listen to your episode before publishing
          </p>
        </div>

        <WaveformPlayer />
        <EpisodeCard />

        {/* All Files Section */}
        <div className="p-6 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood">
          <h3 className="text-xl font-semibold text-satsang-bark mb-4">📁 All Output Files</h3>
          {loading ? (
            <p className="text-satsang-ash text-sm">Loading files...</p>
          ) : files.length === 0 ? (
            <p className="text-satsang-ash text-sm">No files generated yet. Run a processing step.</p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between p-3 bg-white rounded border border-satsang-sandalwood/30"
                >
                  <div className="flex-1">
                    <p className="font-medium text-satsang-bark text-sm">{file.name}</p>
                    <p className="text-xs text-satsang-ash">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => downloadFile(file.name)}
                    className="px-3 py-1 text-xs font-medium text-satsang-saffron hover:text-satsang-bark bg-transparent border border-satsang-saffron rounded hover:bg-satsang-parchment transition"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button onClick={() => setView('dashboard')} variant="outlined" size="md">
          ← Back to Dashboard
        </Button>
      </div>

      {/* Right Column: Thumbnail & Download */}
      <div className="lg:col-span-1 space-y-6 sticky top-8 h-fit">
        <ThumbnailDisplay />
        <DownloadPanel />
      </div>
    </div>
  );
}
