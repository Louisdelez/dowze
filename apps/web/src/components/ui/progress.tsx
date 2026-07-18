import { cn } from '@/lib/cn';

interface ProgressProps {
  /** Valeur 0–100. */
  value: number;
  className?: string;
  label?: string;
}

/** Barre de progression accessible (une seule couleur d'accent). */
export function Progress({ value, className, label }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
