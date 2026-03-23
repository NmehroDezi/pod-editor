import type { ProcessingStep } from '../types/episode';

export const INITIAL_STEPS: ProcessingStep[] = [
  {
    id: 'stitch',
    label: 'Stitching Audio',
    description: 'Combining your MP3 files in order',
    status: 'pending',
    progressPercent: 0,
  },
  {
    id: 'noise',
    label: 'Noise Removal',
    description: 'Cleaning background hiss and hum',
    status: 'pending',
    progressPercent: 0,
  },
  {
    id: 'silence',
    label: 'Silence Compression',
    description: 'Removing dead air between segments',
    status: 'pending',
    progressPercent: 0,
  },
  {
    id: 'music',
    label: 'Music & Normalization',
    description: 'Normalizing volume and blending music',
    status: 'pending',
    progressPercent: 0,
  },
  {
    id: 'fadeout',
    label: 'Fade Out Effect',
    description: 'Adding 3-second fadeout to the end',
    status: 'pending',
    progressPercent: 0,
  },
  {
    id: 'description',
    label: 'Optimize Description',
    description: 'Creating Spotify-optimized description',
    status: 'pending',
    progressPercent: 0,
  },
];
