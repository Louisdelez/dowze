'use client';

import { useEffect, useState } from 'react';

/** Catégorie de temps → pilote les effets sur la map (pluie/neige/brouillard/orage). */
export type WeatherCategory = 'clear' | 'clouds' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WeatherHour { time: string; tempC: number; code: number; pop: number; isDay: boolean }
export interface WeatherDay { date: string; min: number; max: number; code: number; pop: number }

export interface WeatherState {
  loading: boolean;
  tempC: number | null;
  code: number | null;
  isDay: boolean;
  category: WeatherCategory;
  label: string;
  /** Clé d'icône (Lucide inline) affichée dans le HUD. */
  icon: string;
  city: string | null;
  /** Coordonnées réelles (géoloc ou repli IP) — pilotent la course du soleil/lune. */
  lat: number | null;
  lon: number | null;
  /** Détails « vraie app météo » (popup). */
  feelsC: number | null;
  humidity: number | null;
  windKmh: number | null;
  precipMm: number | null;
  cloud: number | null;
  sunrise: string | null;
  sunset: string | null;
  hourly: WeatherHour[];
  daily: WeatherDay[];
}

interface Coords {
  lat: number;
  lon: number;
  city?: string | null;
}

/** Codes WMO (Open-Meteo) → catégorie d'effet (pluie/neige/…). Réutilisé par le module ambiant. */
export function wmoCategory(code: number): WeatherCategory {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'clouds';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'clouds';
}

/** Codes WMO (Open-Meteo) → catégorie + libellé FR + icône. */
function classify(code: number, isDay: boolean): { category: WeatherCategory; label: string; icon: string } {
  if (code === 0) return { category: 'clear', label: 'Ciel clair', icon: isDay ? 'sun' : 'moon' };
  if (code === 1) return { category: 'clear', label: 'Plutôt clair', icon: isDay ? 'cloudSun' : 'moon' };
  if (code === 2) return { category: 'clouds', label: 'Partiellement nuageux', icon: 'cloudSun' };
  if (code === 3) return { category: 'clouds', label: 'Couvert', icon: 'cloud' };
  if (code === 45 || code === 48) return { category: 'fog', label: 'Brouillard', icon: 'cloudFog' };
  if (code >= 51 && code <= 57) return { category: 'rain', label: 'Bruine', icon: 'cloudRain' };
  if (code >= 61 && code <= 67) return { category: 'rain', label: 'Pluie', icon: 'cloudRain' };
  if (code >= 71 && code <= 77) return { category: 'snow', label: 'Neige', icon: 'cloudSnow' };
  if (code >= 80 && code <= 82) return { category: 'rain', label: 'Averses', icon: 'cloudRain' };
  if (code === 85 || code === 86) return { category: 'snow', label: 'Averses de neige', icon: 'cloudSnow' };
  if (code >= 95) return { category: 'storm', label: 'Orage', icon: 'cloudLightning' };
  return { category: 'clouds', label: 'Nuageux', icon: 'cloud' };
}

/** Icône (clé Lucide) pour un code WMO — utilisé par les prévisions. */
export function wmoIcon(code: number, isDay: boolean): string {
  return classify(code, isDay).icon;
}
/** Libellé FR d'un code WMO. */
export function wmoLabel(code: number): string {
  return classify(code, true).label;
}

async function getCoords(): Promise<Coords> {
  // 1) Géolocalisation du navigateur (précise, avec permission).
  const geo = await new Promise<Coords | null>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 600_000 },
    );
  });
  if (geo) return geo;
  // 2) Repli par IP (sans permission).
  const r = await fetch('https://ipwho.is/');
  const j = await r.json();
  if (j && j.success && typeof j.latitude === 'number') {
    return { lat: j.latitude, lon: j.longitude, city: j.city ?? null };
  }
  throw new Error('géolocalisation indisponible');
}

/** Reverse-geocoding : coordonnées → nom de ville (BigDataCloud, gratuit, sans clé, CORS ok). */
async function reverseCity(lat: number, lon: number): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&localityLanguage=fr`,
    );
    const j = await r.json();
    return j.city || j.locality || j.principalSubdivision || null;
  } catch {
    return null;
  }
}

const INITIAL: WeatherState = {
  loading: true,
  tempC: null,
  code: null,
  isDay: true,
  category: 'clear',
  label: '',
  icon: 'sun',
  city: null,
  lat: null,
  lon: null,
  feelsC: null,
  humidity: null,
  windKmh: null,
  precipMm: null,
  cloud: null,
  sunrise: null,
  sunset: null,
  hourly: [],
  daily: [],
};

/** Météo + heure locale RÉELLES selon la localisation (géoloc navigateur, repli IP). */
export function useLocalWeather(): WeatherState {
  const [state, setState] = useState<WeatherState>(INITIAL);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const c = await getCoords();
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(3)}&longitude=${c.lon.toFixed(3)}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,precipitation,cloud_cover` +
          `&hourly=temperature_2m,weather_code,precipitation_probability` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max` +
          `&forecast_days=7&timezone=auto`;
        const [j, cityName] = await Promise.all([
          fetch(url).then((res) => res.json()),
          reverseCity(c.lat, c.lon).then((name) => name ?? c.city ?? null),
        ]);
        if (!alive) return;
        const cur = j.current ?? {};
        const code = Number(cur.weather_code ?? 0);
        const isDay = Number(cur.is_day ?? 1) === 1;
        const t = Number(cur.temperature_2m);
        const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
        // Prévisions horaires : les 12 prochaines heures à partir de « maintenant ».
        const H = j.hourly ?? {};
        const times: string[] = Array.isArray(H.time) ? H.time : [];
        const nowIso: string = cur.time ?? times[0] ?? '';
        let start = times.findIndex((tt) => tt >= nowIso);
        if (start < 0) start = 0;
        const hourly: WeatherHour[] = times.slice(start, start + 12).map((tt, i) => {
          const idx = start + i;
          const hh = Number(tt.slice(11, 13));
          return { time: tt, tempC: Math.round(Number(H.temperature_2m?.[idx] ?? 0)), code: Number(H.weather_code?.[idx] ?? 0), pop: Number(H.precipitation_probability?.[idx] ?? 0), isDay: hh >= 7 && hh < 20 };
        });
        // Prévisions journalières : 6 jours.
        const D = j.daily ?? {};
        const dts: string[] = Array.isArray(D.time) ? D.time : [];
        const daily: WeatherDay[] = dts.slice(0, 6).map((d, i) => ({ date: d, min: Math.round(Number(D.temperature_2m_min?.[i] ?? 0)), max: Math.round(Number(D.temperature_2m_max?.[i] ?? 0)), code: Number(D.weather_code?.[i] ?? 0), pop: Number(D.precipitation_probability_max?.[i] ?? 0) }));
        setState({
          loading: false,
          tempC: Number.isFinite(t) ? Math.round(t) : null,
          code,
          isDay,
          city: cityName,
          lat: c.lat,
          lon: c.lon,
          feelsC: num(cur.apparent_temperature) != null ? Math.round(Number(cur.apparent_temperature)) : null,
          humidity: num(cur.relative_humidity_2m),
          windKmh: num(cur.wind_speed_10m) != null ? Math.round(Number(cur.wind_speed_10m)) : null,
          precipMm: num(cur.precipitation),
          cloud: num(cur.cloud_cover),
          sunrise: D.sunrise?.[0] ?? null,
          sunset: D.sunset?.[0] ?? null,
          hourly,
          daily,
          ...classify(code, isDay),
        });
      } catch {
        if (alive) setState((s) => ({ ...s, loading: false }));
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 15 * 60 * 1000); // rafraîchi toutes les 15 min
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return state;
}
