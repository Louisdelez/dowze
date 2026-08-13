/**
 * Client Supabase (auth côté navigateur). Réexporté depuis `@dowze/auth` : la
 * session est désormais stockée dans un cookie sur `.dowze.ch` (SSO partagé
 * avec les futurs plugins), plus dans le `localStorage` cloisonné par origine.
 * On garde cet import `@/lib/supabase` pour ne pas toucher tous les appelants.
 */
export { getSupabase, globalLogout } from '@dowze/auth';
