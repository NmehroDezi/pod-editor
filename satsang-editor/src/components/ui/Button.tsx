import type { ReactNode } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    'font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary:
      'bg-satsang-saffron text-white hover:bg-satsang-turmeric active:scale-95',
    secondary:
      'bg-satsang-parchment text-satsang-bark hover:bg-satsang-turmeric hover:text-white active:scale-95',
    outlined:
      'border-2 border-satsang-sandalwood text-satsang-bark hover:border-satsang-saffron hover:text-satsang-saffron active:scale-95',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
