import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'active' | 'pending';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-satsang-parchment text-satsang-bark',
    success: 'bg-green-100 text-green-800',
    active: 'bg-satsang-turmeric text-white animate-pulse',
    pending: 'bg-satsang-ash text-white',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
