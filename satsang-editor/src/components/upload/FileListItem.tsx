import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Music } from 'lucide-react';
import type { AudioFile } from '../../types/episode';
import { useEpisodeStore } from '../../store/episodeStore';

interface FileListItemProps {
  audioFile: AudioFile;
  index: number;
}

export function FileListItem({ audioFile, index }: FileListItemProps) {
  const removeFile = useEpisodeStore((state) => state.removeFile);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: audioFile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
        isDragging
          ? 'border-satsang-turmeric bg-satsang-turmeric/10 shadow-lg scale-105'
          : 'border-satsang-sandalwood bg-satsang-parchment hover:border-satsang-saffron'
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-2 hover:bg-satsang-sandalwood/20 rounded"
      >
        <GripVertical className="w-5 h-5 text-satsang-ash" />
      </div>

      {/* Order Number */}
      <div className="flex-shrink-0">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-satsang-saffron text-white font-bold text-sm">
          {index + 1}
        </span>
      </div>

      {/* Music Icon */}
      <Music className="w-5 h-5 text-satsang-turmeric flex-shrink-0" />

      {/* File Details */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-satsang-bark truncate">
          {audioFile.name}
        </p>
        <p className="text-sm text-satsang-ash">
          {formatSize(audioFile.sizeBytes)}
          {audioFile.durationSeconds && (
            <>
              {' '}
              • {Math.floor(audioFile.durationSeconds)}s
            </>
          )}
        </p>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => removeFile(audioFile.id)}
        className="flex-shrink-0 p-2 hover:bg-red-100 rounded-lg text-red-600 transition-all"
        title="Remove file"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
