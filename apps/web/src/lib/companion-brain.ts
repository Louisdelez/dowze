// « Cerveau » du compagnon — IA de jeu vidéo SANS LLM : règles + utility AI + banque de répliques.
// 100 % côté client : instantané, aucune requête réseau, aucune clé IA, aucun crédit. Complément de l'IA réelle.
import type { PetMood } from '@/lib/api';
import type { WeatherCategory } from '@/lib/use-local-weather';

export interface BrainCtx {
  name: string;
  mood: PetMood;
  satiety: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  hour: number; // 0..23.99 (heure locale réelle)
  isDay: boolean;
  weather: WeatherCategory;
  tempC: number | null;
  room: string; // id de pièce
}

/* ---------- Banque de répliques (pré-écrites, taguées par contexte) ---------- */
interface LineEntry {
  w?: number; // poids relatif (défaut 1)
  when?: (c: BrainCtx) => boolean; // condition d'éligibilité
  lines: string[];
}

const hungry = (c: BrainCtx) => c.satiety < 30;
const tired = (c: BrainCtx) => c.energy < 30;
const dirty = (c: BrainCtx) => c.hygiene < 30;
const sad = (c: BrainCtx) => c.happiness < 30;
const sick = (c: BrainCtx) => c.health < 30;
const great = (c: BrainCtx) =>
  Math.min(c.satiety, c.happiness, c.energy, c.hygiene, c.health) >= 70;
const isNight = (c: BrainCtx) => c.hour >= 22 || c.hour < 6;

const LINES: LineEntry[] = [
  // Bavardage général (toujours éligible)
  {
    w: 2,
    lines: [
      'Hii !',
      'Coucou, je suis là !',
      'On fait quoi ?',
      'Tu me tiens compagnie ?',
      'Pioupiou.',
      'Je gambade un peu !',
      'Tu as vu comme je marche bien ?',
      'Je réfléchis… à rien du tout.',
      'Tu restes avec moi ?',
      'La vie de compagnon, c’est chouette.',
    ],
  },
  // Encouragement aux études (léger)
  {
    w: 1,
    lines: [
      'On révise un peu ensemble ?',
      'Prêt à apprendre ?',
      'Tu gères tes cours, continue !',
      'Une petite séance ?',
      'Je crois en toi pour tes tests !',
    ],
  },
  // États (jauges basses) — plus fréquents quand actifs
  {
    w: 4,
    when: hungry,
    lines: [
      'J’ai un petit creux…',
      'On mange bientôt ?',
      'Mon ventre gargouille !',
      'Un petit snack ?',
    ],
  },
  {
    w: 4,
    when: tired,
    lines: [
      'Je suis tout mou…',
      'Un peu fatigué, là…',
      'J’aimerais faire une sieste.',
      'Zzz… pardon.',
    ],
  },
  {
    w: 4,
    when: dirty,
    lines: ['Je me sens pas très propre…', 'Un petit nettoyage ?', 'Bloup, je suis tout crado.'],
  },
  {
    w: 4,
    when: sad,
    lines: [
      'J’ai le moral en berne…',
      'On joue un peu ? Ça me remonterait.',
      'Un câlin me ferait du bien.',
    ],
  },
  {
    w: 5,
    when: sick,
    lines: ['Je me sens patraque…', 'J’ai pas la forme du tout…', 'Aïe, je suis un peu malade.'],
  },
  {
    w: 3,
    when: great,
    lines: [
      'Je suis en pleine forme !',
      'La grande forme aujourd’hui !',
      'Je pète le feu !',
      'Tout va super bien !',
    ],
  },
  // Heure du jour
  {
    w: 2,
    when: (c) => c.hour >= 6 && c.hour < 11,
    lines: ['Bonjour ! Bien dormi ?', 'Le soleil se lève, debout !', 'Petit-déj, puis on révise ?'],
  },
  {
    w: 2,
    when: (c) => c.hour >= 11 && c.hour < 18,
    lines: ['Belle journée, non ?', 'On profite de l’après-midi ?', 'Ça avance, tes cours ?'],
  },
  {
    w: 2,
    when: (c) => c.hour >= 18 && c.hour < 22,
    lines: ['La soirée est douce.', 'Bientôt l’heure de dormir.', 'Bonne soirée !'],
  },
  {
    w: 3,
    when: isNight,
    lines: [
      'Il est tard… on devrait dormir.',
      'Chut, c’est la nuit.',
      'Les étoiles sont sorties.',
      'Zzz…',
    ],
  },
  // Météo réelle
  {
    w: 3,
    when: (c) => c.weather === 'rain',
    lines: ['Il pleut dehors, on reste au chaud.', 'J’aime le bruit de la pluie.', 'Plic, ploc !'],
  },
  {
    w: 4,
    when: (c) => c.weather === 'snow',
    lines: ['Il neige ! C’est magnifique.', 'Brr, il neige.', 'On fait un bonhomme de neige ?'],
  },
  {
    w: 3,
    when: (c) => c.weather === 'fog',
    lines: ['C’est tout brumeux…', 'On y voit rien avec ce brouillard.'],
  },
  {
    w: 4,
    when: (c) => c.weather === 'storm',
    lines: ['Oh, un orage ! Je reste près de toi.', 'Boum ! L’orage gronde.'],
  },
  {
    w: 2,
    when: (c) => c.weather === 'clear' && c.isDay,
    lines: ['Quel beau ciel dégagé !', 'Le soleil brille !'],
  },
  {
    w: 3,
    when: (c) => c.tempC != null && c.tempC <= 4,
    lines: ['Brr, il fait froid.', 'Je me pelotonne, il gèle.'],
  },
  {
    w: 3,
    when: (c) => c.tempC != null && c.tempC >= 29,
    lines: ['Il fait chaud aujourd’hui !', 'Un peu de fraîcheur ?'],
  },
  // Pièce
  {
    w: 2,
    when: (c) => c.room === 'chambre',
    lines: ['J’aime bien ma chambre.', 'On se repose ici ?'],
  },
  {
    w: 2,
    when: (c) => c.room === 'salon',
    lines: ['Le salon, c’est cosy.', 'On se détend au salon ?'],
  },
  {
    w: 2,
    when: (c) => c.room === 'cuisine',
    lines: ['Ça sent bon, la cuisine !', 'On grignote un truc ?'],
  },
  {
    w: 2,
    when: (c) => c.room === 'bureau',
    lines: ['Au travail ! On révise ?', 'Le bureau, c’est pour étudier.'],
  },
  {
    w: 2,
    when: (c) => c.room === 'jardin',
    lines: ['L’air frais du jardin, j’adore !', 'On gambade dehors ?'],
  },
  {
    w: 2,
    when: (c) => c.room === 'plage',
    lines: ['La plage ! J’entends les vagues.', 'Sable et soleil, le rêve.'],
  },
  // Bavardage général (variété)
  {
    w: 2,
    lines: [
      'Tu savais que je t’aime bien ?',
      'Raconte-moi ta journée !',
      'On forme une bonne équipe.',
      'Je veille sur toi, promis.',
      'Dis, on apprend quoi aujourd’hui ?',
      'Je suis toujours content de te voir.',
    ],
  },
  // ---- Combos « intelligents » : pièce × météo × heure × état ----
  {
    w: 6,
    when: (c) => (c.room === 'jardin' || c.room === 'plage') && c.weather === 'rain',
    lines: ['On est dehors sous la pluie… on rentre ?', 'Il pleut sur nous, vite un abri !'],
  },
  {
    w: 7,
    when: (c) => (c.room === 'jardin' || c.room === 'plage') && c.weather === 'snow',
    lines: [
      'De la neige dehors ! Bataille de boules de neige ?',
      'Il neige sur nous, c’est féérique !',
    ],
  },
  {
    w: 6,
    when: (c) => (c.room === 'jardin' || c.room === 'plage') && c.weather === 'storm',
    lines: ['Un orage et on est dehors… on file à l’abri !', 'Ça gronde, rentrons vite !'],
  },
  {
    w: 5,
    when: (c) => c.room === 'jardin' && c.weather === 'clear' && c.isDay,
    lines: ['Le jardin au soleil, le paradis !', 'Quelle belle journée pour le jardin !'],
  },
  {
    w: 7,
    when: (c) => c.room === 'plage' && c.tempC != null && c.tempC >= 26,
    lines: ['La plage sous la chaleur, on se baigne ?', 'Sable chaud et grand soleil, parfait !'],
  },
  {
    w: 5,
    when: (c) => c.room === 'plage' && !c.isDay,
    lines: ['La plage la nuit, on écoute les vagues.', 'Une balade nocturne sur le sable ?'],
  },
  {
    w: 7,
    when: (c) => c.room === 'cuisine' && c.satiety < 40,
    lines: ['La cuisine ET j’ai faim… supplice !', 'Ça sent bon et mon ventre crie famine !'],
  },
  {
    w: 5,
    when: (c) => c.room === 'chambre' && (c.hour >= 22 || c.hour < 6),
    lines: ['Ma chambre la nuit, parfait pour dormir.', 'Au lit, il se fait tard.'],
  },
  {
    w: 7,
    when: (c) => c.room === 'chambre' && c.energy < 35,
    lines: ['Direction le lit, je suis vidé.', 'Ma chambre… une petite sieste ?'],
  },
  {
    w: 5,
    when: (c) => c.room === 'salon' && c.hour >= 18 && c.hour < 23,
    lines: ['Soirée cocooning au salon ?', 'On se pose tranquille au salon ce soir ?'],
  },
  {
    w: 7,
    when: (c) => c.room === 'bureau' && c.hour >= 8 && c.hour < 19,
    lines: [
      'Au bureau : on se concentre sur les cours.',
      'Le bureau t’attend, une petite séance ?',
      'C’est l’heure d’étudier, non ?',
    ],
  },
  {
    w: 4,
    when: (c) => c.room === 'bureau' && (c.hour >= 22 || c.hour < 6),
    lines: ['Réviser à cette heure ? Repose-toi plutôt.', 'Le bureau à minuit… courage à toi !'],
  },
  {
    w: 4,
    when: (c) => c.weather === 'storm' && (c.room === 'chambre' || c.room === 'salon'),
    lines: [
      'L’orage dehors, mais on est bien à l’abri.',
      'Boum ! Heureusement qu’on est au chaud.',
    ],
  },
  {
    w: 4,
    when: (c) => c.weather === 'rain' && (c.room === 'chambre' || c.room === 'salon'),
    lines: ['La pluie à la fenêtre, cocon parfait.', 'Il pleut, on reste blottis à l’intérieur.'],
  },

  // ===== Banque étendue (moins de répétitions) =====
  // Bavardage général — variété
  {
    w: 2,
    lines: [
      'Alors, quoi de neuf ?',
      'Je te trouve super, tu sais.',
      'On passe un bon moment, non ?',
      'Je me sens bien avec toi.',
      'Tu veux qu’on fasse un truc ensemble ?',
      'Petite pause câlin plus tard ?',
      'Je gigote un peu, c’est plus fort que moi.',
      'Tranquille, la vie de compagnon.',
    ],
  },
  {
    w: 2,
    lines: [
      'Hop hop hop !',
      'Je fais quelques pas.',
      'Je surveille les environs.',
      'Rien à signaler par ici.',
      'Je patrouille dans la pièce.',
      'Je m’étire un peu.',
      'Un petit tour et je reviens.',
    ],
  },
  {
    w: 2,
    lines: [
      'Tu es mon humain préféré.',
      'Merci d’être là pour moi.',
      'Tu comptes beaucoup pour moi.',
      'On est une chouette équipe.',
      'Je suis chanceux de t’avoir.',
    ],
  },
  {
    w: 1,
    lines: [
      'Je me demande ce qu’il y a dehors…',
      'Tu crois que les nuages ont un goût ?',
      'Pourquoi les meubles bougent pas tout seuls ?',
      'Je réfléchis à des trucs de compagnon.',
      'Un jour j’explorerai toute la maison !',
    ],
  },
  { w: 1, lines: ['Boop.', 'Bip bip !', 'Wiii !', 'Ta-daa !', 'Hmm-hmm…', 'Pouet !'] },
  // Études / motivation — variété
  {
    w: 1,
    lines: [
      'Chaque petit pas compte, tu gères.',
      'Un objectif à la fois, on y va !',
      'Tu progresses, je le vois bien.',
      'N’oublie pas de faire des pauses aussi.',
      'Fier de toi, continue comme ça.',
      'Tu es plus fort que tu crois.',
      'On révise cinq minutes ?',
      'Tes efforts vont payer, j’en suis sûr.',
    ],
  },
  // Heure — matin
  {
    w: 2,
    when: (c) => c.hour >= 6 && c.hour < 11,
    lines: [
      'Un café… enfin, pour toi !',
      'La journée commence bien ?',
      'Debout, plein de choses à faire !',
      'J’adore les matins avec toi.',
      'On attaque la journée du bon pied ?',
    ],
  },
  // Heure — journée
  {
    w: 2,
    when: (c) => c.hour >= 11 && c.hour < 18,
    lines: [
      'L’après-midi file vite, non ?',
      'Une petite collation ?',
      'On avance bien aujourd’hui !',
      'Le milieu de journée, mon moment préféré.',
      'Encore plein d’énergie ?',
    ],
  },
  // Heure — soir
  {
    w: 2,
    when: (c) => c.hour >= 18 && c.hour < 22,
    lines: [
      'On se détend pour ce soir ?',
      'Belle fin de journée, non ?',
      'Bientôt le moment de souffler.',
      'La lumière du soir est douce.',
      'On a bien mérité un peu de repos.',
    ],
  },
  // Heure — nuit
  {
    w: 2,
    when: isNight,
    lines: [
      'La maison est si calme la nuit.',
      'Fais de beaux rêves, plus tard.',
      'On veille un peu ensemble ?',
      'La lune nous regarde.',
      'Doucement… c’est l’heure du silence.',
    ],
  },
  // Météo — variété
  {
    w: 2,
    when: (c) => c.weather === 'rain',
    lines: [
      'Les gouttes dansent sur la vitre.',
      'Un temps parfait pour un chocolat chaud.',
      'La pluie, ça sent bon.',
      'On compte les gouttes ?',
    ],
  },
  {
    w: 3,
    when: (c) => c.weather === 'snow',
    lines: [
      'Tout devient tout blanc dehors !',
      'La neige, c’est magique.',
      'On mettrait bien une écharpe.',
      'Des flocons ! J’adore.',
    ],
  },
  {
    w: 2,
    when: (c) => c.weather === 'fog',
    lines: [
      'Le brouillard rend tout mystérieux.',
      'On dirait un rêve, dehors.',
      'Chut… tout est ouaté.',
    ],
  },
  {
    w: 3,
    when: (c) => c.weather === 'storm',
    lines: [
      'Ça tonne fort ! Je reste blotti.',
      'L’orage fait du bruit, mais on est bien.',
      'Un éclair ! Tu as vu ?',
    ],
  },
  {
    w: 2,
    when: (c) => c.weather === 'clouds',
    lines: [
      'Le ciel est un peu gris aujourd’hui.',
      'Des nuages tout doux là-haut.',
      'Temps calme, parfait pour bosser.',
    ],
  },
  {
    w: 2,
    when: (c) => c.weather === 'clear' && c.isDay,
    lines: [
      'Pas un nuage, quelle chance !',
      'Le soleil me donne la pêche !',
      'Journée radieuse en perspective.',
    ],
  },
  {
    w: 2,
    when: (c) => c.weather === 'clear' && !c.isDay,
    lines: [
      'Ciel dégagé, on voit les étoiles.',
      'Belle nuit étoilée.',
      'La nuit est claire, c’est joli.',
    ],
  },
  // Pièces — variété
  {
    w: 2,
    when: (c) => c.room === 'chambre',
    lines: ['Ma chambre, mon petit cocon.', 'On se pose sur le lit ?', 'C’est douillet ici.'],
  },
  {
    w: 2,
    when: (c) => c.room === 'salon',
    lines: [
      'Le salon, l’endroit parfait pour flâner.',
      'On se met à l’aise ?',
      'Ambiance détente ici.',
    ],
  },
  {
    w: 2,
    when: (c) => c.room === 'cuisine',
    lines: [
      'On se prépare un petit truc ?',
      'La cuisine, mon endroit gourmand.',
      'J’aime bien traîner par ici.',
    ],
  },
  {
    w: 2,
    when: (c) => c.room === 'bureau',
    lines: [
      'Ici, on se met en mode focus.',
      'Le bureau, c’est sérieux !',
      'Un espace rien que pour apprendre.',
    ],
  },
  {
    w: 2,
    when: (c) => c.room === 'jardin',
    lines: [
      'Ça sent bon les fleurs !',
      'On respire le grand air ?',
      'J’adore courir dans l’herbe.',
    ],
  },
  {
    w: 2,
    when: (c) => c.room === 'plage',
    lines: [
      'Le bruit des vagues, quel bonheur.',
      'On construit un château de sable ?',
      'Les pieds dans le sable, le rêve.',
    ],
  },
  // États — variété
  {
    w: 4,
    when: hungry,
    lines: [
      'Mon estomac fait des bruits rigolos.',
      'On mangerait bien un morceau…',
      'Je pense très fort à de la nourriture.',
    ],
  },
  {
    w: 4,
    when: tired,
    lines: [
      'Mes paupières sont lourdes…',
      'Un petit somme me ferait du bien.',
      'Je baille, pardon !',
    ],
  },
  {
    w: 4,
    when: dirty,
    lines: [
      'Je crois que j’ai besoin d’un coup de propre.',
      'Un bon bain, ça me tente.',
      'Je me sens un peu poussiéreux.',
    ],
  },
  {
    w: 4,
    when: sad,
    lines: [
      'J’aurais besoin d’un peu de réconfort.',
      'On se remonte le moral ?',
      'Un câlin chasserait mes soucis.',
    ],
  },
  {
    w: 3,
    when: great,
    lines: [
      'Tout roule, je suis au top !',
      'Jamais été aussi bien !',
      'La forme olympique aujourd’hui !',
      'Je déborde d’énergie !',
    ],
  },
];

/* ---------- Réactions aux soins (feed/play/sleep/clean/heal/cuddle) ---------- */
const REACTIONS: Record<string, string[]> = {
  feed: [
    'Miam, merci !',
    'Un vrai délice !',
    'Je me régale !',
    'Encore un peu ?',
    'Trop bon, ça !',
    'Mon plat préféré !',
    'Ça remplit bien le ventre !',
    'Slurp, un régal !',
    'Tu cuisines trop bien !',
    'Rassasié, merci à toi !',
  ],
  play: [
    'Trop rigolo !',
    'On rejoue vite ?',
    'Youpi, un jeu !',
    'J’adore jouer avec toi !',
    'Encore, encore !',
    'C’était génial !',
    'Haha, trop fort !',
    'On s’amuse trop !',
    'Quel bon moment !',
    'Refais-le, refais-le !',
  ],
  sleep: [
    'Zzz… merci.',
    'Une bonne sieste…',
    'Je récupère un peu.',
    'Ça fait tellement de bien.',
    'Dodo réparateur…',
    'Je rêve déjà…',
    'Un petit somme, parfait.',
    'Je me sens tout reposé.',
  ],
  clean: [
    'Tout propre !',
    'Ça brille, regarde !',
    'Merci pour le bain !',
    'Je me sens tout frais !',
    'Nickel chrome !',
    'Plus une tache !',
    'Je sens super bon maintenant.',
    'Douceur et propreté !',
  ],
  heal: [
    'Je me sens déjà mieux.',
    'Merci du soin !',
    'Ça va beaucoup mieux !',
    'Tu prends soin de moi.',
    'Presque guéri, merci !',
    'Tu es un super soignant.',
    'Adieu les bobos !',
    'Je reprends des forces.',
  ],
  cuddle: [
    'Un câlin, j’adore !',
    'C’est tout doux…',
    'Encore un câlin ?',
    'Je t’adore, toi !',
    'Le meilleur des câlins !',
    'Mon cœur fond…',
    'Tout chaud, tout doux.',
    'Je me blottis contre toi.',
  ],
};

/** Réplique de réaction à une action de soin (varie, évite la dernière). */
export function pickReaction(action: string, c: BrainCtx, last?: string | null): string {
  const pool = REACTIONS[action] ?? ['Merci !'];
  const filtered = pool.length > 1 && last ? pool.filter((l) => l !== last) : pool;
  const text = filtered[Math.floor(Math.random() * filtered.length)] ?? pool[0]!;
  return text.replace(/\{name\}/g, c.name || 'Dowze');
}

/** Choisit une réplique contextuelle (pondérée, en évitant les répliques récentes). Instantané. */
export function pickLine(c: BrainCtx, recent?: string | string[] | null): string {
  const avoid = Array.isArray(recent) ? recent : recent ? [recent] : [];
  const eligible = LINES.filter((e) => !e.when || e.when(c));
  const total = eligible.reduce((s, e) => s + (e.w ?? 1), 0);
  let roll = Math.random() * total;
  let entry = eligible[eligible.length - 1]!;
  for (const e of eligible) {
    roll -= e.w ?? 1;
    if (roll <= 0) {
      entry = e;
      break;
    }
  }
  let pool = entry.lines;
  if (pool.length > 1 && avoid.length) {
    const filtered = pool.filter((l) => !avoid.includes(l));
    if (filtered.length) pool = filtered;
  }
  const text = pool[Math.floor(Math.random() * pool.length)] ?? entry.lines[0]!;
  return text.replace(/\{name\}/g, c.name || 'Dowze');
}

/* ---------- Comportement autonome (utility AI) ---------- */
export type AutoKind = 'sleep' | 'wander' | 'visit' | 'idle' | 'talk';
export interface AutoAction {
  kind: AutoKind;
  pauseMs: number; // délai avant la prochaine décision
  say: boolean; // émettre une bulle en plus
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Décide la prochaine action autonome selon l'état (comme un Tamagotchi qui vit seul). */
export function decideAction(c: BrainCtx, opts: { hasFurniture: boolean }): AutoAction {
  const weights: Record<Exclude<AutoKind, 'talk'>, number> = {
    sleep: (isNight(c) ? 6 : 0) + (c.energy < 25 ? 5 : 0) + (c.mood === 'fatigue' ? 3 : 0),
    wander: c.isDay && !isNight(c) ? 5 : 1,
    visit: opts.hasFurniture ? 2 : 0,
    idle: 2,
  };
  // Mauvais temps → moins de balade, plus se poser.
  if (c.weather === 'rain' || c.weather === 'snow' || c.weather === 'storm') {
    weights.wander = Math.max(1, weights.wander - 3);
    weights.idle += 2;
  }
  const total = weights.sleep + weights.wander + weights.visit + weights.idle;
  let roll = Math.random() * total;
  let kind: AutoKind = 'idle';
  for (const k of ['sleep', 'wander', 'visit', 'idle'] as const) {
    roll -= weights[k];
    if (roll <= 0) {
      kind = k;
      break;
    }
  }
  const pauseMs =
    kind === 'sleep'
      ? rand(9000, 15000)
      : kind === 'wander'
        ? rand(2500, 5000)
        : kind === 'visit'
          ? rand(3000, 5000)
          : rand(2200, 4200);
  // Parle en plus ~28 % du temps (jamais en dormant).
  const say = kind !== 'sleep' && Math.random() < 0.28;
  return { kind, pauseMs, say };
}

/** Case de balade proche (1..3 cases), libre, dans la grille. Renvoie null si rien de valable. */
export function pickWanderTarget(
  pos: { c: number; r: number },
  occupied: Set<string>,
  cols: number,
  rows: number,
): { c: number; r: number } | null {
  for (let i = 0; i < 24; i++) {
    const c = Math.max(0, Math.min(cols - 1, Math.round(pos.c + rand(-3, 3))));
    const r = Math.max(0, Math.min(rows - 1, Math.round(pos.r + rand(-3, 3))));
    if ((c === Math.round(pos.c) && r === Math.round(pos.r)) || occupied.has(`${c},${r}`)) continue;
    return { c, r };
  }
  return null;
}
