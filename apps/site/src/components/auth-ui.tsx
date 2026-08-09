'use client';

import type { ReactNode } from 'react';
import { TopBar } from '@/components/topbar';

export function Field({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-extrabold uppercase italic tracking-tight text-black">{label}</span>
      <input
        {...props}
        className="w-full border-2 border-black bg-white px-3 py-2.5 text-sm font-semibold text-black outline-none transition placeholder:font-medium placeholder:text-black/30 focus:border-dowze-red"
      />
      {hint && <span className="mt-1 block text-[11px] font-medium text-black/50">{hint}</span>}
    </label>
  );
}

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <TopBar />
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm border-2 border-black bg-white p-6">
          <h1 className="mb-5 text-2xl font-black uppercase italic tracking-tight">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

export function SubmitButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full bg-dowze-red px-4 py-3 text-sm font-extrabold uppercase italic tracking-tight text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
