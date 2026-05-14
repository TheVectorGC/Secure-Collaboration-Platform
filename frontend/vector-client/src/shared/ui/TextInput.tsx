import { type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function TextInput({ label, className, ...props }: TextInputProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          {label}
        </span>
      )}
      <input
        className={clsx(
          'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-400/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-violet-500/10',
          className,
        )}
        {...props}
      />
    </label>
  );
}
