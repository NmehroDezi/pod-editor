import { useEpisodeStore } from '../../store/episodeStore';

export function EpisodeCard() {
  const metadata = useEpisodeStore((state) => state.metadata);

  return (
    <div className="rounded-xl bg-satsang-parchment p-8 border-2 border-satsang-sandalwood">
      {metadata.title && (
        <>
          <h2 className="text-2xl font-heading font-semibold text-satsang-bark mb-4">
            {metadata.title}
          </h2>

          <div className="w-12 h-1 bg-gradient-to-r from-satsang-saffron to-satsang-turmeric rounded-full mb-6" />
        </>
      )}

      {metadata.description && (
        <p className="text-satsang-bark leading-relaxed">
          {metadata.description}
        </p>
      )}

      {!metadata.title && !metadata.description && (
        <p className="text-satsang-ash italic">No episode details provided</p>
      )}
    </div>
  );
}
