import Link from 'next/link';

const NAV = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/progression', label: 'Progression' },
  { href: '/planning', label: 'Planning' },
  { href: '/validation', label: 'Validation' },
  { href: '/bridge', label: 'Pont .json' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Dowze
        </Link>
        <nav className="flex gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
