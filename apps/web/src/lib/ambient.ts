'use client';

// Contexte ambiant GLOBAL (heure locale + météo) pour le compagnon flottant des autres pages.
// Météo par IP uniquement → AUCUN prompt de géolocalisation, mise en cache 30 min (mémoire + localStorage).
// Léger, prompt-free, partagé : un seul fetch pour tout le site.
import { useEffect, useState } from 'react';
import { wmoCategory } from '@/lib/use-local-weather';
import type { WeatherCategory } from '@/lib/use-local-weather';

interface Ambient {
  weather: WeatherCategory;
  isDay: boolean;
  tempC: number | null;
}

const CACHE_KEY = 'dowze-ambient-weather';
const TTL = 30 * 60 * 1000;
let mem: { at: number; data: Ambient } | null = null;
let inflight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  const geo = await (await fetch('https://ipwho.is/')).json();
  if (!geo || !geo.success || typeof geo.latitude !== 'number') throw new Error('ip');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude.toFixed(3)}` +
    `&longitude=${geo.longitude.toFixed(3)}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const w = await (await fetch(url)).json();
  const cur = w.current ?? {};
  const t = Number(cur.temperature_2m);
  mem = {
    at: Date.now(),
    data: {
      weather: wmoCategory(Number(cur.weather_code ?? 0)),
      isDay: Number(cur.is_day ?? 1) === 1,
      tempC: Number.isFinite(t) ? Math.round(t) : null,
    },
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(mem));
  } catch {
    /* ignore */
  }
}

export interface AmbientState {
  hour: number; // heure locale décimale (0..23.99)
  weather: WeatherCategory;
  isDay: boolean;
  tempC: number | null;
}

/** Heure locale (live) + météo ambiante (IP, sans prompt). Partagé par tout le site. */
export function useAmbient(): AmbientState {
  const [amb, setAmb] = useState<Ambient | null>(
    mem && Date.now() - mem.at < TTL ? mem.data : null,
  );
  const [hour, setHour] = useState(12);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setHour(d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600);
    };
    tick();
    const cid = window.setInterval(tick, 30_000);

    (async () => {
      if (!mem) {
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) mem = JSON.parse(raw);
        } catch {
          /* ignore */
        }
      }
      if (mem && Date.now() - mem.at < TTL) {
        setAmb(mem.data);
        return;
      }
      if (!inflight)
        inflight = refresh()
          .catch(() => {})
          .finally(() => {
            inflight = null;
          });
      await inflight;
      if (mem) setAmb(mem.data);
    })();

    return () => window.clearInterval(cid);
  }, []);

  return {
    hour,
    weather: amb?.weather ?? 'clear',
    isDay: amb?.isDay ?? true,
    tempC: amb?.tempC ?? null,
  };
}
