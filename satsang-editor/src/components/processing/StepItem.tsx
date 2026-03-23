import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import type { ProcessingStep } from '../../types/episode';

interface StepItemProps {
  step: ProcessingStep;
  isLast?: boolean;
}

export function StepItem({ step }: StepItemProps) {
  const isPending = step.status === 'pending';
  const isActive = step.status === 'active';
  const isComplete = step.status === 'complete';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`p-4 rounded-lg transition-all text-center w-40 h-40 flex flex-col ${
        isActive
          ? 'bg-satsang-saffron/20 border-2 border-satsang-saffron'
          : isComplete
          ? 'bg-green-50 border-2 border-green-300'
          : 'bg-satsang-parchment border-2 border-satsang-sandalwood'
      }`}
    >
      {/* Status Circle */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.15, 1] : 1,
        }}
        transition={{
          duration: 2,
          repeat: isActive ? Infinity : 0,
        }}
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white relative mx-auto mb-2 ${
          isPending
            ? 'bg-satsang-ash'
            : isActive
            ? 'bg-satsang-saffron ring-4 ring-satsang-turmeric/50'
            : 'bg-green-500'
        }`}
      >
        {isActive && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {isComplete && <Check className="w-4 h-4" />}
        {isPending && <span className="text-xs">—</span>}
      </motion.div>

      {/* Step Content - flex-1 to fill available space */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <h3
          className={`font-semibold text-sm line-clamp-2 ${
            isPending
              ? 'text-satsang-ash'
              : isActive
              ? 'text-satsang-saffron'
              : 'text-green-700'
          }`}
        >
          {step.label}
        </h3>
        <p
          className={`text-xs mt-0.5 line-clamp-2 ${
            isPending ? 'text-satsang-ash' : 'text-satsang-bark'
          }`}
        >
          {step.description}
        </p>
      </div>

      {/* Progress Bar (only for active) - fixed at bottom */}
      {isActive && (
        <motion.div className="mt-auto w-full bg-satsang-parchment rounded-full h-2 overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-satsang-saffron to-satsang-turmeric h-full"
            initial={{ width: 0 }}
            animate={{ width: `${step.progressPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
