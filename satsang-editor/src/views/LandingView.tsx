import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useEpisodeStore } from '../store/episodeStore';

export function LandingView() {
  const [title, setTitle] = useState('');
  const setProjectTitle = useEpisodeStore((state) => state.setProjectTitle);
  const setView = useEpisodeStore((state) => state.setView);

  const handleStart = () => {
    if (title.trim()) {
      setProjectTitle(title);
      setView('dashboard');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-heading font-semibold text-satsang-bark">
            ॐ Satsang
          </h1>
          <p className="text-lg text-satsang-ash">
            Create your podcast episode
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-satsang-bark mb-2">
              Project Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter episode title..."
              onKeyPress={(e) => e.key === 'Enter' && handleStart()}
              autoFocus
            />
          </div>

          <Button
            onClick={handleStart}
            disabled={!title.trim()}
            variant="primary"
            size="lg"
            className="w-full"
          >
            Start Project
          </Button>
        </div>
      </div>
    </div>
  );
}
