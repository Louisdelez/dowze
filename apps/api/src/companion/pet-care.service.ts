import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { accounts, profiles, petCare, petRoom, companionAgents, companionCare } from '../db/schema';
import { MATERIAL_PRICES } from './material-prices.generated';
import { FURNITURE_PRICES } from './furniture-prices.generated';

/** Grille isométrique de la « maison » et limites de validation. */
// Borne max des coordonnées d'items : Maison = 8×8, mais les open-spaces vont jusqu'à 256×256.
const MAX_COORD = 256;
// Marge : meubles + peinture PAR CARRÉ (jusqu'à 64 tuiles sol + 48 carrés mur en marqueurs ~).
const MAX_ITEMS = 300;

export interface RoomItem {
  item: string;
  c: number;
  r: number;
}
export interface RoomState {
  room: string;
  /** Meubles PAR pièce : { [idPièce]: RoomItem[] }. */
  rooms: Record<string, RoomItem[]>;
}

function sanitizeItems(raw: unknown): RoomItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RoomItem[] = [];
  for (const it of raw.slice(0, MAX_ITEMS)) {
    const o = it as Record<string, unknown>;
    const item = typeof o.item === 'string' ? o.item.slice(0, 40) : '';
    const c = Math.round(Number(o.c));
    const r = Math.round(Number(o.r));
    if (
      item &&
      Number.isInteger(c) &&
      Number.isInteger(r) &&
      c >= 0 &&
      c < MAX_COORD &&
      r >= 0 &&
      r < MAX_COORD
    ) {
      out.push({ item, c, r });
    }
  }
  return out;
}

/** Valide la map { pièce → meubles }. Tolère l'ancien format (tableau) → migré sous « chambre ». */
function sanitizeRoomMap(raw: unknown): Record<string, RoomItem[]> {
  if (Array.isArray(raw)) {
    const legacy = sanitizeItems(raw);
    return legacy.length ? { chambre: legacy } : {};
  }
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, RoomItem[]> = {};
  let total = 0;
  // Garde-fou global 400 items : on TRONQUE au sein d'une pièce plutôt que de faire disparaître des pièces entières
  // (l'ancien `break` supprimait la pièce qui dépassait ET toutes les suivantes → perte de données silencieuse).
  const MAX_TOTAL = 400;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>).slice(0, 64)) {
    if (total >= MAX_TOTAL) break;
    let items = sanitizeItems(val);
    if (total + items.length > MAX_TOTAL) items = items.slice(0, MAX_TOTAL - total);
    total += items.length;
    out[key.slice(0, 40)] = items;
  }
  return out;
}

const STATS = ['satiety', 'happiness', 'energy', 'hygiene', 'health'] as const;
type Stat = (typeof STATS)[number];

/** Décroissance par heure (jauges 0..100, plus haut = mieux). Douce (non-punitif). */
const DECAY_PER_HOUR: Record<'satiety' | 'happiness' | 'energy' | 'hygiene', number> = {
  satiety: 4,
  happiness: 3,
  energy: 3,
  hygiene: 2,
};

/** Effets des actions de soin. */
const ACTIONS: Record<string, Partial<Record<Stat, number>>> = {
  feed: { satiety: 35, hygiene: -5, health: 2 },
  play: { happiness: 28, energy: -12, satiety: -6 },
  sleep: { energy: 40, happiness: 3 },
  clean: { hygiene: 50 },
  heal: { health: 45 },
  cuddle: { happiness: 16, energy: 2 },
};

export type PetMood = 'malade' | 'fatigue' | 'affame' | 'sale' | 'triste' | 'heureux' | 'ok';

/** Catalogue de la Boutique : prix (gold) par objet. Source de vérité SERVEUR.
 *  Meubles + MATERIAL_PRICES (100+ sols, 100+ murs — catalogue généré). */
const SHOP_PRICES: Record<string, number> = { ...MATERIAL_PRICES, ...FURNITURE_PRICES };

/** Stock possédé PAR matériau, en UNITÉS (1 unité = 1 carré). Colonne `owned` (jsonb) réutilisée — 0 migration. */
function sanitizeStock(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (Array.isArray(raw)) {
    // Rétro-compat : ancienne liste d'ids possédés (booléen) → gros stock accordé.
    for (const x of raw) if (typeof x === 'string' && x in SHOP_PRICES) out[x] = 99;
    return out;
  }
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (k in SHOP_PRICES && typeof v === 'number' && v > 0)
        out[k] = Math.min(9999, Math.floor(v));
    }
  }
  return out;
}

export interface CareState {
  satiety: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  ageDays: number;
  mood: PetMood;
  gold: number;
  stock: Record<string, number>;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function moodOf(s: {
  satiety: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
}): PetMood {
  if (s.health <= 20) return 'malade';
  if (s.energy <= 20) return 'fatigue';
  if (s.satiety <= 20) return 'affame';
  if (s.hygiene <= 20) return 'sale';
  if (s.happiness <= 20) return 'triste';
  if (Math.min(s.satiety, s.happiness, s.energy, s.hygiene, s.health) >= 70) return 'heureux';
  return 'ok';
}

export function contextualMood(
  state: Parameters<typeof moodOf>[0],
  now: Date,
  weather?: 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow',
): PetMood {
  const base = moodOf(state);
  if (base !== 'ok' && base !== 'heureux') return base;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 12);
  if ((hour >= 22 || hour < 6) && state.energy < 60) return 'fatigue';
  if ((weather === 'storm' || weather === 'rain') && state.happiness < 55) return 'triste';
  if ((weather === 'sunny' || weekday === 'Fri') && state.happiness >= 55) return 'heureux';
  if (weekday === 'Sun' && hour >= 18 && state.happiness < 55) return 'triste';
  return base;
}

interface Row {
  satiety: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  gold: number;
  owned: unknown;
  bornAt: Date;
  lastTick: Date;
}

/** Applique la décroissance depuis `lastTick` jusqu'à `now` (temps réel). */
function decayed(row: Row, now: Date): Row {
  const hours = Math.max(0, (now.getTime() - row.lastTick.getTime()) / 3_600_000);
  if (hours <= 0) return row;
  const satiety = clamp(row.satiety - DECAY_PER_HOUR.satiety * hours);
  const happiness = clamp(row.happiness - DECAY_PER_HOUR.happiness * hours);
  const energy = clamp(row.energy - DECAY_PER_HOUR.energy * hours);
  const hygiene = clamp(row.hygiene - DECAY_PER_HOUR.hygiene * hours);
  // Santé : baisse si négligé (satiété/hygiène/bonheur très bas), sinon régénère lentement.
  const neglect = (satiety < 20 ? 1 : 0) + (hygiene < 20 ? 1 : 0) + (happiness < 15 ? 1 : 0);
  const health = clamp(row.health + (neglect > 0 ? -2 * neglect : 1) * hours);
  return { ...row, satiety, happiness, energy, hygiene, health, lastTick: now };
}

function toState(row: Row, now: Date): CareState {
  const ageDays = Math.floor((now.getTime() - row.bornAt.getTime()) / 86_400_000);
  return {
    satiety: row.satiety,
    happiness: row.happiness,
    energy: row.energy,
    hygiene: row.hygiene,
    health: row.health,
    ageDays,
    mood: contextualMood(row, now),
    gold: row.gold ?? 0,
    stock: sanitizeStock(row.owned),
  };
}

// --- Care PAR compagnon (agents) : mêmes règles que le pet principal, sans gold/stock. ---
export interface AgentCareState {
  agentId: string;
  satiety: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  ageDays: number;
  mood: PetMood;
}
interface AgentRow {
  agentId: string;
  satiety: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  bornAt: Date;
  lastTick: Date;
}
/** Décroissance d'un agent (réutilise `decayed` en fournissant gold/owned factices, ignorés). */
function decayedAgent(row: AgentRow, now: Date): AgentRow {
  const d = decayed({ ...row, gold: 0, owned: [] } as unknown as Row, now);
  return {
    ...row,
    satiety: d.satiety,
    happiness: d.happiness,
    energy: d.energy,
    hygiene: d.hygiene,
    health: d.health,
    lastTick: d.lastTick,
  };
}
function toAgentState(row: AgentRow, now: Date): AgentCareState {
  const ageDays = Math.floor((now.getTime() - row.bornAt.getTime()) / 86_400_000);
  return {
    agentId: row.agentId,
    satiety: row.satiety,
    happiness: row.happiness,
    energy: row.energy,
    hygiene: row.hygiene,
    health: row.health,
    ageDays,
    mood: contextualMood(row, now),
  };
}

@Injectable()
export class PetCareService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Vérifie que l'agent appartient au profil de l'utilisateur (sinon 400). */
  private async assertOwnedAgent(profileId: string, agentId: string): Promise<void> {
    const a = (
      await this.db
        .select({ pid: companionAgents.profileId })
        .from(companionAgents)
        .where(eq(companionAgents.id, agentId))
    )[0];
    if (!a || a.pid !== profileId) throw new BadRequestException('Compagnon introuvable.');
  }

  /** Récupère (ou crée) la ligne de care d'un agent. Création idempotente (anti-course : deux requêtes concurrentes). */
  private async agentCareRow(agentId: string): Promise<AgentRow> {
    let row = (
      await this.db.select().from(companionCare).where(eq(companionCare.agentId, agentId))
    )[0];
    if (!row) {
      await this.db.insert(companionCare).values({ agentId }).onConflictDoNothing();
      row = (
        await this.db.select().from(companionCare).where(eq(companionCare.agentId, agentId))
      )[0]!;
    }
    return row as AgentRow;
  }

  private async persistAgent(row: AgentRow, now: Date): Promise<void> {
    await this.db
      .update(companionCare)
      .set({
        satiety: row.satiety,
        happiness: row.happiness,
        energy: row.energy,
        hygiene: row.hygiene,
        health: row.health,
        lastTick: now,
        updatedAt: now,
      })
      .where(eq(companionCare.agentId, row.agentId));
  }

  /** Care d'UN compagnon (après décroissance, persistée). */
  async getAgentCare(authId: string, agentId: string): Promise<AgentCareState> {
    const profileId = await this.profileIdForAuth(authId);
    await this.assertOwnedAgent(profileId, agentId);
    const now = new Date();
    const row = await this.agentCareRow(agentId);
    const next = decayedAgent(row, now);
    if (next.lastTick !== row.lastTick) await this.persistAgent(next, now);
    return toAgentState(next, now);
  }

  /** Applique une action de soin à UN compagnon. */
  async actAgentCare(authId: string, agentId: string, action: string): Promise<AgentCareState> {
    const effect = ACTIONS[action];
    if (!effect) throw new BadRequestException('Action inconnue.');
    const profileId = await this.profileIdForAuth(authId);
    await this.assertOwnedAgent(profileId, agentId);
    const now = new Date();
    const base = decayedAgent(await this.agentCareRow(agentId), now);
    const applied: AgentRow = { ...base };
    for (const [k, v] of Object.entries(effect))
      applied[k as Stat] = clamp((base[k as Stat] as number) + (v as number));
    await this.persistAgent(applied, now);
    return toAgentState(applied, now);
  }

  /** Care de TOUS les compagnons d'un espace (hors principal & relais) → moyenne + barres côté client. */
  async listSpaceCare(authId: string, space: string): Promise<AgentCareState[]> {
    const profileId = await this.profileIdForAuth(authId);
    const agents = await this.db
      .select({ id: companionAgents.id })
      .from(companionAgents)
      .where(
        and(
          eq(companionAgents.profileId, profileId),
          eq(companionAgents.space, space),
          eq(companionAgents.isPrimary, false),
          ne(companionAgents.mode, 'relay'),
          eq(companionAgents.status, 'active'),
        ),
      );
    const now = new Date();
    const out: AgentCareState[] = [];
    for (const a of agents) {
      const row = await this.agentCareRow(a.id);
      const next = decayedAgent(row, now);
      if (next.lastTick !== row.lastTick) await this.persistAgent(next, now);
      out.push(toAgentState(next, now));
    }
    return out;
  }

  private async profileIdForAuth(authId: string): Promise<string> {
    const acc = (await this.db.select().from(accounts).where(eq(accounts.authUserId, authId)))[0];
    if (!acc) throw new BadRequestException('Compte introuvable.');
    const prof = (await this.db.select().from(profiles).where(eq(profiles.accountId, acc.id)))[0];
    if (!prof) throw new BadRequestException('Profil introuvable.');
    return prof.id;
  }

  /** Récupère (ou crée) la ligne pet_care d'un profil. Création idempotente (anti-course concurrente). */
  private async petCareRow(profileId: string): Promise<Row> {
    let row = (await this.db.select().from(petCare).where(eq(petCare.profileId, profileId)))[0];
    if (!row) {
      await this.db.insert(petCare).values({ profileId }).onConflictDoNothing();
      row = (await this.db.select().from(petCare).where(eq(petCare.profileId, profileId)))[0]!;
    }
    return row as Row;
  }

  /** Récupère (ou crée) l'état, applique la décroissance et persiste `last_tick`. */
  async get(authId: string): Promise<CareState> {
    const profileId = await this.profileIdForAuth(authId);
    const now = new Date();
    const row = await this.petCareRow(profileId);
    const next = decayed(row as Row, now);
    if (next.lastTick !== (row as Row).lastTick) {
      await this.db
        .update(petCare)
        .set({
          satiety: next.satiety,
          happiness: next.happiness,
          energy: next.energy,
          hygiene: next.hygiene,
          health: next.health,
          lastTick: now,
          updatedAt: now,
        })
        .where(eq(petCare.profileId, profileId));
    }
    return toState(next, now);
  }

  /** Applique une action de soin (après décroissance) et persiste. */
  async act(authId: string, action: string): Promise<CareState> {
    const effect = ACTIONS[action];
    if (!effect) throw new BadRequestException('Action inconnue.');
    const profileId = await this.profileIdForAuth(authId);
    const now = new Date();
    const row = await this.petCareRow(profileId);
    const base = decayed(row as Row, now);
    const applied: Row = { ...base };
    for (const [k, v] of Object.entries(effect)) {
      applied[k as Stat] = clamp((base[k as Stat] as number) + (v as number));
    }
    await this.db
      .update(petCare)
      .set({
        satiety: applied.satiety,
        happiness: applied.happiness,
        energy: applied.energy,
        hygiene: applied.hygiene,
        health: applied.health,
        lastTick: now,
        updatedAt: now,
      })
      .where(eq(petCare.profileId, profileId));
    return toState(applied, now);
  }

  /** Boutique : achète `qty` UNITÉS d'un matériau (débite le gold, ajoute au stock). Prix = serveur, PAR unité. */
  async buy(authId: string, item: string, qty = 1): Promise<CareState> {
    const price = SHOP_PRICES[item];
    if (price === undefined) throw new BadRequestException('Objet inconnu.');
    const n = Math.max(1, Math.min(999, Math.floor(qty)));
    const cost = price * n;
    const profileId = await this.profileIdForAuth(authId);
    const now = new Date();
    const row = await this.petCareRow(profileId);
    const stock = sanitizeStock((row as Row).owned);
    const gold = (row as Row).gold ?? 0;
    if (gold < cost) throw new BadRequestException('Pas assez de gold.');
    const nextStock = { ...stock, [item]: (stock[item] ?? 0) + n };
    await this.db
      .update(petCare)
      .set({ gold: gold - cost, owned: nextStock, updatedAt: now })
      .where(eq(petCare.profileId, profileId));
    // Applique la décroissance pour renvoyer un état cohérent (sans re-persister lastTick ici).
    const base = decayed(row as Row, now);
    return toState({ ...base, gold: gold - cost, owned: nextStock }, now);
  }

  /** « Maison » : récupère (ou crée) la pièce + les meubles placés. */
  async getRoom(authId: string): Promise<RoomState> {
    const profileId = await this.profileIdForAuth(authId);
    let row = (await this.db.select().from(petRoom).where(eq(petRoom.profileId, profileId)))[0];
    if (!row) {
      await this.db.insert(petRoom).values({ profileId }).onConflictDoNothing();
      row = (await this.db.select().from(petRoom).where(eq(petRoom.profileId, profileId)))[0]!;
    }
    return { room: row.room, rooms: sanitizeRoomMap(row.items) };
  }

  /** « Maison » : enregistre la pièce courante + les meubles PAR pièce. */
  async setRoom(authId: string, room: string, rooms: unknown): Promise<RoomState> {
    const profileId = await this.profileIdForAuth(authId);
    const clean: RoomState = {
      room: (room || 'chambre').slice(0, 40),
      rooms: sanitizeRoomMap(rooms),
    };
    const now = new Date();
    await this.db
      .insert(petRoom)
      .values({ profileId, room: clean.room, items: clean.rooms, updatedAt: now })
      .onConflictDoUpdate({
        target: petRoom.profileId,
        set: { room: clean.room, items: clean.rooms, updatedAt: now },
      });
    return clean;
  }
}
