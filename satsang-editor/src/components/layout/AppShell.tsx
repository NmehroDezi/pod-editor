import { Home, ArrowLeft } from 'lucide-react';
import { useEpisodeStore } from '../../store/episodeStore';

interface AppShellProps {
  children: React.ReactNode;
}

// Map view to previous view for back button
const backButtonMap: Record<string, string> = {
  landing: 'landing',
  dashboard: 'landing',
  'audio-upload': 'dashboard',
  'audio-processing': 'dashboard', // Go to dashboard, not back to upload
  'music-select': 'dashboard',
  'music-processing': 'dashboard', // Go to dashboard, not back to select
  'image-prompt': 'dashboard',
  'image-result': 'dashboard', // Go to dashboard, not back to prompt
  preview: 'dashboard',
};

export function AppShell({ children }: AppShellProps) {
  const currentView = useEpisodeStore((state) => state.currentView);
  const completedSteps = useEpisodeStore((state) => state.completedSteps);
  const setView = useEpisodeStore((state) => state.setView);

  const isAudioComplete = completedSteps.includes('audio');
  const isMusicComplete = completedSteps.includes('music');
  const isImageComplete = completedSteps.includes('image');

  const handleBack = () => {
    const previousView = backButtonMap[currentView] || 'landing';
    setView(previousView as any);
  };

  const projectTitle = useEpisodeStore((state) => state.projectTitle);
  const reset = useEpisodeStore((state) => state.reset);

  const handleHome = () => {
    // If user has an active project, go to dashboard; otherwise go to landing
    if (projectTitle && projectTitle.trim().length > 0) {
      setView('dashboard');
    } else {
      setView('landing');
    }
  };

  const handleNewSession = () => {
    reset();
    setView('landing');
  };

  const showProgressBar = currentView !== 'landing' && currentView !== 'preview';
  // Hide back button on processing pages (completion state) - use "Next Steps" button instead
  const isOnCompletionPage = currentView === 'audio-processing' || currentView === 'music-processing' || currentView === 'image-result';
  const showBackButton = currentView !== 'landing' && !isOnCompletionPage;

  return (
    <div className="min-h-screen bg-satsang-cream flex flex-col">
      {/* Top Navigation Bar - Sticky */}
      <nav className="sticky top-0 z-50 bg-white shadow-sm border-b-2 border-satsang-sandalwood">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            {/* Left: Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-satsang-gold">ॐ</div>
              <h1 className="text-2xl font-heading font-semibold text-satsang-bark">
                Satsang Editor
              </h1>
            </div>

            {/* Right: Navigation Buttons */}
            <div className="flex items-center gap-2">
              {showBackButton && (
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-satsang-parchment rounded-lg transition"
                  title="Go back"
                >
                  <ArrowLeft className="w-5 h-5 text-satsang-bark" />
                </button>
              )}
              <button
                onClick={handleHome}
                className="p-2 hover:bg-satsang-parchment rounded-lg transition"
                title="Go to dashboard"
              >
                <Home className="w-5 h-5 text-satsang-bark" />
              </button>
              <button
                onClick={handleNewSession}
                className="px-3 py-2 text-sm font-medium text-white bg-satsang-saffron rounded-lg hover:bg-satsang-turmeric transition"
                title="Start a new project"
              >
                + New Session
              </button>
            </div>
          </div>

          {/* Progress Bar - 3-segment */}
          {showProgressBar && (
            <div className="flex items-center gap-3">
              {/* Audio Segment */}
              <div className="flex-1 h-3 rounded-full overflow-hidden bg-satsang-parchment border border-satsang-sandalwood">
                <div
                  className={`h-full transition-all ${
                    isAudioComplete
                      ? 'w-full bg-green-500'
                      : 'w-0 bg-satsang-saffron'
                  }`}
                />
              </div>

              {/* Music Segment */}
              <div className="flex-1 h-3 rounded-full overflow-hidden bg-satsang-parchment border border-satsang-sandalwood">
                <div
                  className={`h-full transition-all ${
                    isMusicComplete
                      ? 'w-full bg-green-500'
                      : 'w-0 bg-satsang-saffron'
                  }`}
                />
              </div>

              {/* Image Segment */}
              <div className="flex-1 h-3 rounded-full overflow-hidden bg-satsang-parchment border border-satsang-sandalwood">
                <div
                  className={`h-full transition-all ${
                    isImageComplete
                      ? 'w-full bg-green-500'
                      : 'w-0 bg-satsang-saffron'
                  }`}
                />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-4">
        {children}
      </main>
    </div>
  );
}
