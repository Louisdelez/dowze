import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// D'après DESIGN.md : CTA marketing en pilule (rounded-full), boutons
// utilitaires plus serrés (rounded-md). Un seul bleu structurant.
type Variant = 'primary' | 'secondary' | 'utility' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const BASE =
  'inline-flex items-center justify-center font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<Variant, string> = {
  // CTA principal : pilule bleue.
  primary:
    'rounded-full px-5 py-2 text-base bg-accent text-accent-foreground hover:bg-accent-active',
  // CTA secondaire : pilule blanche, hairline + ombre douce.
  secondary:
    'rounded-full px-5 py-2 text-base bg-surface text-foreground border border-border shadow-sm hover:bg-muted',
  // Bouton utilitaire (nav, sélection) : coins serrés.
  utility:
    'rounded-md px-3.5 py-1 text-sm bg-surface text-foreground border border-border hover:bg-muted',
  ghost: 'rounded-md px-4 py-2 text-sm bg-transparent text-foreground hover:bg-muted',
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return <button className={cn(BASE, VARIANTS[variant], className)} {...props} />;
}
