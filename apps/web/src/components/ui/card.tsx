import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// feature-card (DESIGN.md) : surface blanche sur canvas papier, rayon 12px,
// élévation « à peine là » (hairline + ombre très douce).
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface p-6 shadow-sm', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-bold tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}
