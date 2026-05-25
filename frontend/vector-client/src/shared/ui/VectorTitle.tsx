import clsx from 'clsx';
import vectorLogoFullUrl from '../../assets/vector-logo-full.png';
import vectorWordmarkUrl from '../../assets/vector-wordmark.png';

type VectorTitleVariant = 'login' | 'mobile';

type VectorTitleProps = {
  variant?: VectorTitleVariant;
  className?: string;
};

export function VectorTitle({ variant = 'login', className }: VectorTitleProps) {
  if (variant === 'login') {
    return (
      <div className={clsx('flex items-center gap-6', className)}>
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-2xl shadow-violet-950/35">
          <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.14),transparent_42%),radial-gradient(circle_at_72%_80%,rgba(139,92,246,0.18),transparent_44%)]" />
          <img
            src={vectorLogoFullUrl}
            alt="Vector"
            className="relative h-20 w-20 object-contain drop-shadow-[0_18px_34px_rgba(124,58,237,0.36)]"
            draggable={false}
          />
        </div>
        <div className="min-w-0">
          <img
            src={vectorWordmarkUrl}
            alt="Vector"
            className="h-16 w-auto max-w-[360px] object-contain drop-shadow-[0_18px_38px_rgba(124,58,237,0.22)]"
            draggable={false}
          />
          <div className="mt-3 h-px w-full max-w-[340px] bg-gradient-to-r from-violet-300/45 via-fuchsia-300/20 to-transparent" />
        </div>
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div className={clsx('flex items-center justify-center gap-4', className)}>
        <img
          src={vectorLogoFullUrl}
          alt="Vector"
          className="h-14 w-14 object-contain drop-shadow-[0_16px_26px_rgba(124,58,237,0.28)]"
          draggable={false}
        />
        <img
          src={vectorWordmarkUrl}
          alt="Vector"
          className="h-9 w-auto max-w-[190px] object-contain"
          draggable={false}
        />
      </div>
    );
  }

  return null;
}
