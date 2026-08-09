'use client';

import { useEffect, useRef, useState } from 'react';
import type { XpView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { claimDailyXp, getXp, heartbeatXp } from '@/lib/api';

/**
 * Barre de NIVEAU & XP (engagement, personnelle, monotone — distincte des rangs pédagogiques).
 * XP : connexion quotidienne (au montage), + temps ACTIF (heartbeat anti-idle : onglet visible +
 * interaction récente ; le serveur plafonne). Auto-référencé, aucun classement.
 */
export function XpBar() {
  const { profileId, signedIn } = useProfile();
  const [xp, setXp] = useState<XpView | null>(null);
  const lastActive = useRef<number>(Date.now());

  // Suivi d'activité réelle (anti-idle) : toute interaction rafraîchit lastActive.
  useEffect(() => {
    const mark = () => {
      lastActive.current = Date.now();
    };
    const evts = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    evts.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => evts.forEach((e) => window.removeEventListener(e, mark));
  }, []);

  useEffect(() => {
    if (!signedIn || !profileId) return;
    let stop = false;
    // Connexion quotidienne (idempotent côté serveur) puis état courant.
    claimDailyXp(profileId)
      .then((v) => !stop && setXp(v))
      .catch(() => getXp(profileId).then((v) => !stop && setXp(v)).catch(() => {}));

    // Heartbeat de temps actif : toutes les 60 s, si visible ET actif dans la dernière minute.
    const iv = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastActive.current > 60_000) return; // inactif → on ne crédite pas
      heartbeatXp(profileId, 60)
        .then((v) => !stop && setXp(v))
        .catch(() => {});
    }, 60_000);

    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [signedIn, profileId]);

  if (!signedIn || !xp) return null;

  return (
    <div className="flex items-center gap-2" title={`Niveau ${xp.level} · ${xp.xpIntoLevel}/${xp.xpForNext} XP${xp.streak > 1 ? ` · série ${xp.streak} j` : ''}`}>
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-violet-600 px-1.5 text-xs font-bold text-white">
        {xp.level}
      </span>
      <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-muted sm:block">
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round(xp.progressPct * 100)}%` }} />
      </div>
    </div>
  );
}
