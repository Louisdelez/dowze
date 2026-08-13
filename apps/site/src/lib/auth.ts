import { getSupabase } from '@dowze/auth';

export { getSupabase };
// Après connexion/inscription → le STORE Dowze (partie infra, une fois connecté).
export const ACADEMIE = 'https://infra.dowze.ch';
const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface RegisterInput {
  email: string;
  authUserId: string | null;
  isMinor: boolean;
  displayName: string;
  locale: string;
  timezone: string;
  birthDate: string | null;
  guardianEmail: string | null;
}

/** Crée le compte + profil côté cœur (api.dowze.ch), avec le jeton de la session Supabase. */
export async function registerAccount(input: RegisterInput): Promise<unknown> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${API}/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'Inscription impossible');
  return res.json();
}

/** Âge en années révolues, ou null si la date est vide/invalide. */
export function ageFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}
