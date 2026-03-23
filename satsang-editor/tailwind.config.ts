import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors: {
      'satsang-saffron': '#E8650A',
      'satsang-turmeric': '#F2A31B',
      'satsang-sandalwood': '#C4834A',
      'satsang-bark': '#7A4F2D',
      'satsang-soil': '#3D2010',
      'satsang-cream': '#FDF5E6',
      'satsang-parchment': '#F5E6CC',
      'satsang-gold': '#D4A017',
      'satsang-ash': '#8B7355',
    },
    fontFamily: {
      heading: ['Crimson Text', 'Georgia', 'serif'],
      body: ['Inter', 'system-ui', 'sans-serif'],
    },
  },
  plugins: [],
} satisfies Config;
