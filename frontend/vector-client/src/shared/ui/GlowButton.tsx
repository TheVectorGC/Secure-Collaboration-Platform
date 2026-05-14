import { type ButtonHTMLAttributes, type PropsWithChildren } from 'react';
import clsx from 'clsx';

type GlowButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: 'primary' | 'ghost';
};

export function GlowButton({ children, className, variant = 'primary', ...props }: GlowButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-2xl px-4 py-3 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500 text-white shadow-lg shadow-violet-950/40 hover:brightness-110',
        variant === 'ghost' &&
          'border border-white/10 bg-white/[0.04] text-zinc-200 hover:border-violet-400/50 hover:bg-violet-400/10',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
