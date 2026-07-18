import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'error';

const TONES: Record<Tone, string> = {
  info: 'border-border bg-muted text-muted-foreground',
  error: 'border-red-200 bg-red-50 text-red-700',
};

/** Encart d'information ou d'erreur — ton bienveillant, jamais un dump technique. */
export function Note({
  children,
  tone = 'info',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('rounded-md border p-3 text-sm', TONES[tone], className)}
    >
      {children}
    </p>
  );
}
