import { useRef } from 'react';
import { useEpisodeStore } from '../../store/episodeStore';

export function WaveformPlayer() {
  const output = useEpisodeStore((state) => state.output);
  const audioRef = useRef<HTMLAudioElement>(null);

  if (!output) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-satsang-parchment p-6 border-2 border-satsang-sandalwood">
        <p className="text-sm text-satsang-bark font-medium mb-3">📁 Final Audio Ready</p>

        {/* Simple HTML5 audio player */}
        <audio
          ref={audioRef}
          controls
          className="w-full"
          style={{
            filter: 'saturate(0.8)',
          }}
        >
          <source src={output.finalAudioUrl} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      </div>

      <p className="text-xs text-satsang-ash text-center">
        ✅ Audio processed and ready to download
      </p>
    </div>
  );
}
