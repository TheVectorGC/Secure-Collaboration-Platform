import { type ButtonHTMLAttributes, type PropsWithChildren } from 'react';
import clsx from 'clsx';

type GlowButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: 'primary' | 'ghost';
};

export function GlowButton({ children, className, variant = 'primary', ...props }: GlowButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-2xl shadow-violet-950/35 hover:brightness-110 active:scale-[0.99]',
        variant === 'ghost' &&
          'border border-white/10 bg-white/[0.055] text-zinc-200 shadow-lg shadow-black/10 hover:border-violet-400/50 hover:bg-violet-400/10 active:scale-[0.99]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
