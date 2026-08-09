/** Sonnerie douce à résonance décroissante (cloche de pleine conscience), non stressante. */
export function playBell(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const ring = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 1.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 1.5);
    };
    // Deux notes douces pour signaler la fin de séance.
    ring(660, 0);
    ring(880, 0.5);
    setTimeout(() => void ctx.close(), 2500);
  } catch {
    // Pas de son disponible : on échoue en silence (jamais bloquant).
  }
}
