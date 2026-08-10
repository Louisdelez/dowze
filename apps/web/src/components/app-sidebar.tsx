'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS, NAV_SECONDARY, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/cn';

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const cls = cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition',
    active
      ? 'bg-muted font-medium text-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );
  const inner = (
    <>
      <Icon className={active ? 'text-accent' : ''} />
      {item.label}
    </>
  );
  // Lien EXTERNE (ex. « Mes apps » → infra.dowze.ch, le store) : ancre classique.
  if (item.href.startsWith('http')) {
    return (
      <a href={item.href} onClick={onNavigate} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cls}
    >
      {inner}
    </Link>
  );
}

/** Contenu de la barre latérale (réutilisé en desktop fixe et en tiroir mobile). */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex h-full flex-col gap-6 p-4">
      <Link href="/" onClick={onNavigate} className="px-3 text-lg font-bold tracking-tight">
        Dowze
      </Link>

      <div className="flex-1 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-0.5 border-t border-border pt-3">
        {NAV_SECONDARY.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}
