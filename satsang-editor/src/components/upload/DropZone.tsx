import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { useEpisodeStore } from '../../store/episodeStore';

export function DropZone() {
  const addFiles = useEpisodeStore((state) => state.addFiles);
  const files = useEpisodeStore((state) => state.files);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      console.log('DropZone onDrop - Accepted:', acceptedFiles.length, acceptedFiles);
      const audioFiles = acceptedFiles.filter((file) =>
        file.type === 'audio/mpeg' || file.type === 'audio/mp4' || 
        file.name.endsWith('.mp3') || file.name.endsWith('.m4a')
      );

      console.log('DropZone onDrop - Audio files:', audioFiles.length, audioFiles);
      if (audioFiles.length > 0) {
        addFiles(audioFiles);
      }

      if (audioFiles.length < acceptedFiles.length) {
        alert('Only MP3 and M4A files are accepted.');
      }
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/mpeg': ['.mp3'], 'audio/mp4': ['.m4a'] },
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
        isDragActive
          ? 'border-satsang-saffron bg-satsang-turmeric/5 scale-105'
          : 'border-satsang-sandalwood bg-satsang-parchment/50 hover:border-satsang-saffron'
      }`}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-4">
        <Upload className="w-16 h-16 text-satsang-turmeric" />
        <div>
          <p className="text-xl font-semibold text-satsang-bark">
            {isDragActive ? 'Drop your audio files here' : 'Drag & drop MP3 or M4A files'}
          </p>
          <p className="text-satsang-ash mt-2">
            or click to select files from your computer
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 inline-block">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-satsang-saffron text-white font-semibold">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        )}

        <p className="text-sm text-satsang-ash mt-4">
          MP3 and M4A files • Upload multiple files and reorder them below
        </p>
      </div>
    </div>
  );
}
