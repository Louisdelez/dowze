import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  accent: 'bg-accent text-accent-foreground',
  success: 'bg-muted text-[color:var(--color-sticker-green)]',
};

/** Petite pastille (eyebrow / statut). */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
