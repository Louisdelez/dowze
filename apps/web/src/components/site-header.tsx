import Link from 'next/link';
import { AuthStatus } from './auth-status';

const NAV = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/progression', label: 'Progression' },
  { href: '/planning', label: 'Planning' },
  { href: '/validation', label: 'Validation' },
  { href: '/communaute', label: 'Communauté' },
  { href: '/parent', label: 'Espace parent' },
  { href: '/bridge', label: 'Pont .json' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Dowze
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <AuthStatus />
        </nav>
      </div>
    </header>
  );
}
