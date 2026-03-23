import { useEpisodeStore } from '../../store/episodeStore';

export function ThumbnailDisplay() {
  const output = useEpisodeStore((state) => state.output);
  const metadata = useEpisodeStore((state) => state.metadata);

  if (!output) return null;

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border-2 border-satsang-sandalwood">
      <div className="relative aspect-square bg-satsang-parchment flex items-center justify-center">
        {output.thumbnailUrl ? (
          <>
            <img
              src={output.thumbnailUrl}
              alt={output.thumbnailAltText}
              className="w-full h-full object-cover"
            />
            {metadata.title && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                <h2 className="text-white font-semibold text-xl">
                  {metadata.title}
                </h2>
              </div>
            )}
          </>
        ) : (
          <div className="text-center">
            <div className="text-6xl text-satsang-gold mb-4">🎨</div>
            <p className="text-satsang-ash">Thumbnail image</p>
          </div>
        )}
      </div>
    </div>
  );
}
