import { motion } from 'framer-motion';
import { useEpisodeStore } from '../../store/episodeStore';
import { StepItem } from './StepItem';

interface StepTrackerProps {
  activePhase?: 'cleanup' | 'mixing' | 'thumbnail' | null;
}

export function StepTracker({ activePhase }: StepTrackerProps) {
  const steps = useEpisodeStore((state) => state.steps);

  // Filter steps based on active phase
  const filteredSteps = steps.filter((step) => {
    if (!activePhase) return true; // Show all if no phase selected

    if (activePhase === 'cleanup') {
      return ['stitch', 'noise', 'silence'].includes(step.id);
    } else if (activePhase === 'mixing') {
      return step.id === 'music';
    } else if (activePhase === 'thumbnail') {
      return step.id === 'thumbnail';
    }
    return true;
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <motion.div
      className="flex items-center justify-center gap-6 flex-wrap"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {filteredSteps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-6">
          <StepItem
            step={step}
            isLast={index === filteredSteps.length - 1}
          />
          {index < filteredSteps.length - 1 && (
            <div className="text-satsang-sandalwood text-2xl">→</div>
          )}
        </div>
      ))}
    </motion.div>
  );
}
