/**
 * @dowze/ui — design system partagé.
 *
 * Contenu : l'utilitaire `cn`, l'`AppLauncher` commun (grille des apps de
 * l'écosystème) et le `CompanionDock` commun (le compagnon présent dans TOUTES
 * les apps). À venir : extraction des primitives d'`apps/web` (Button, Card…).
 */
export { cn } from './cn';
export { AppLauncher, type LauncherApp } from './app-launcher';
export { CompanionDock } from './companion-dock';
export { CodexPet, curatedSheetUrl } from './codex-pet';
