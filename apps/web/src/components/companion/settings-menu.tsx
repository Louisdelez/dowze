'use client';

import { useState, type ReactNode } from 'react';
import { CompanionPicker } from '@/components/companion/companion-picker';
import { CopiloteSettings } from '@/components/copilote-settings';

const ICON: Record<string, ReactNode> = {
  sparkles: (
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  cpu: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
    </>
  ),
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
};
function Ico({ k }: { k: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON[k]}
    </svg>
  );
}

const SECTIONS = [
  { id: 'apparence', label: 'Compagnon', icon: 'sparkles' },
  { id: 'copilote', label: 'Copilote (IA)', icon: 'cpu' },
  { id: 'maison', label: 'Maison', icon: 'home' },
];

/** Menu Paramètres : barre latérale de sections + page correspondante. */
export function SettingsMenu({ onClearRoom }: { onClearRoom: () => void }) {
  const [section, setSection] = useState('apparence');
  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* Barre latérale des sections */}
      <aside className="w-40 shrink-0 space-y-1 border-r border-border pr-3 sm:w-48">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              section === s.id
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Ico k={s.icon} />
            {s.label}
          </button>
        ))}
      </aside>

      {/* Contenu de la section */}
      <div className="min-w-0 flex-1 overflow-auto pr-1">
        {section === 'apparence' && <CompanionPicker />}
        {section === 'copilote' && <CopiloteSettings />}
        {section === 'maison' && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Ta pièce</div>
            <button
              onClick={onClearRoom}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-100"
            >
              Réinitialiser la pièce — sols & murs par défaut
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
