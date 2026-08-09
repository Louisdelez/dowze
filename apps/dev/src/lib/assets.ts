// Catalogue des assets du jeu isométrique (compagnon) + générateur de prompts ChatGPT.
//
// DEUX FAMILLES (comme Habbo Hotel / Les Sims) :
//  1) TEXTURES de surface (sols, murs) — le moteur crée déjà la géométrie iso et « peint » dessus.
//     → swatch CARRÉ, plat (top-down), raccordable (seamless), plein cadre, PAS d'iso, PAS de transparence.
//  2) PROPS à poser sur la map — meubles/objets au sol (furni iso) et objets muraux (fenêtres, tableaux…).
//     → sprite ISOLÉ à fond TRANSPARENT (vrai alpha), à l'angle iso (sol) ou de face (mur).

export type AssetKind = 'prop' | 'wallprop' | 'rug';

export interface Asset {
  id: string; // minuscules, sans espace (kebab) → nom de fichier = `${id}.png`
  label: string; // affichage FR
  category: string; // id de catégorie
  kind: AssetKind;
  desc: string; // description (anglais → meilleur rendu image gen)
}

export interface Category {
  id: string;
  label: string;
  block: string; // couleur pastel (token) pour l'en-tête
  zone: 'Intérieur' | 'Extérieur' | 'Mixte';
}

/** Libellé du type d'asset (badge UI). */
export const KIND_LABEL: Record<AssetKind, string> = {
  prop: 'Meuble / objet (sol)',
  wallprop: 'Objet mural',
  rug: 'Tapis / sol décor',
};

export const CATEGORIES: Category[] = [
  { id: 'ouvertures', label: 'Portes & fenêtres', block: 'lilac', zone: 'Intérieur' },
  { id: 'chambre', label: 'Chambre', block: 'pink', zone: 'Intérieur' },
  { id: 'salon', label: 'Salon', block: 'mint', zone: 'Intérieur' },
  { id: 'cuisine', label: 'Cuisine', block: 'cream', zone: 'Intérieur' },
  { id: 'bureau', label: 'Bureau', block: 'lilac', zone: 'Intérieur' },
  { id: 'deco', label: 'Déco & accessoires', block: 'coral', zone: 'Intérieur' },
  { id: 'jardin', label: 'Jardin', block: 'lime', zone: 'Extérieur' },
  { id: 'plage', label: 'Plage', block: 'mint', zone: 'Extérieur' },
  { id: 'nature', label: 'Nature & plantes', block: 'lime', zone: 'Extérieur' },
  { id: 'objets', label: 'Objets & items', block: 'coral', zone: 'Mixte' },
  { id: 'nourriture', label: 'Nourriture', block: 'pink', zone: 'Mixte' },
  // ===== OPEN-SPACES (thème entreprise) — salles des espaces de travail de la ruche =====
  { id: 'travail', label: 'Espace de travail', block: 'lilac', zone: 'Intérieur' },
  { id: 'cantine', label: 'Cantine (entreprise)', block: 'cream', zone: 'Intérieur' },
  { id: 'sanitaires', label: 'Toilettes (entreprise)', block: 'mint', zone: 'Intérieur' },
  { id: 'repos', label: 'Espace de repos', block: 'pink', zone: 'Intérieur' },
  { id: 'garage', label: 'Garage & parking', block: 'coral', zone: 'Mixte' },
];

/* ---------- Blocs de prompt (optimisés pour l'APP WEB ChatGPT) ----------
   Lignes labellisées (mieux suivies que la prose), positif d'abord + bloc négatif serré.
   Le style visuel est un invariant figé ; seul l'objet / le matériau change. La cohérence d'une
   série vient d'une IMAGE DE RÉFÉRENCE (buildRefPrompt), une ancre PAR FAMILLE. */
const STYLE_CORE =
  'cozy retro pixel-art style (Habbo Hotel × Animal Crossing × Dofus × Tamagotchi vibe), cute soft rounded forms, ' +
  'warm limited pastel palette, crisp clean pixels';
const TRANSPARENT_BG = 'fully transparent — a real RGBA PNG with a genuine alpha channel';
const NOT_PROP =
  'any background scene, floor, ground, surface, wall, cast shadow, reflection, glow, gradient, text, or watermark; ' +
  'NOT a checkerboard pattern, NOT a solid white or grey card — actual transparent pixels';
// Retire l'article initial (« a »/« an ») pour éviter « A single a cozy window ».
const noArt = (d: string) => d.replace(/^(an?)\s+/i, '');

/** Prompt principal (1er asset / ancre). Sprite isolé à fond transparent. */
export function buildPrompt(a: Asset): string {
  const d = noArt(a.desc);
  let head = `A single ${d} as an isometric game prop (furni) to place on the floor of an isometric room.`;
  let view =
    'true isometric 3/4 top-down game angle (~30° tilt), orthographic — no perspective distortion';
  let compo =
    'one isolated object only, centered, floating, generous padding, sharp clean silhouette';
  if (a.kind === 'wallprop') {
    head = `A single ${d} as a wall item, designed to hang flat on the wall of an isometric room (like a Habbo/Sims wall item you place anywhere on a wall).`;
    view = 'flat front-facing straight-on view (the wall plane), orthographic — no perspective';
    compo = 'one isolated item only, centered, floating, generous padding, sharp clean silhouette';
  } else if (a.kind === 'rug') {
    head = `A single ${d}, lying flat on the ground, as an isometric floor decal to place in an isometric room.`;
  }
  return [
    head,
    '',
    `View: ${view}.`,
    `Style: ${STYLE_CORE}, sharp clean silhouette, soft shading with a consistent top-left light, reads like a ~64px game sprite.`,
    `Composition: ${compo}.`,
    `Background: ${TRANSPARENT_BG}.`,
    `Do NOT include: ${NOT_PROP}.`,
    'Output: one PNG, transparent background.',
  ].join('\n');
}

/** Variante « cohérence » : à coller APRÈS avoir joint l'image ancre de la même famille. */
export function buildRefPrompt(a: Asset): string {
  const obj = `a ${noArt(a.desc)}`;
  const viewRef =
    a.kind === 'wallprop'
      ? 'a flat front-facing straight-on wall-item view (the wall plane), orthographic, no perspective'
      : a.kind === 'rug'
        ? 'the true isometric top-down angle, lying flat on the ground'
        : 'the true isometric 3/4 top-down angle, orthographic';
  return [
    'Use the uploaded image as a STRICT style reference for a game-prop set.',
    '',
    'PRESERVE EXACTLY (do not change): art style (cozy retro pixel art, same pixel scale and rendering), palette and ' +
      'saturation, lighting direction and soft shading, line weight, edge treatment and level of detail.',
    `CHANGE ONLY THIS: the object is now ${obj}, shown at ${viewRef}.`,
    `CONSTRAINTS: one single isolated object, centered, generous padding, clean silhouette; background ${TRANSPARENT_BG}; no ${NOT_PROP}.`,
    'Output: one PNG, transparent background, matching the reference style precisely.',
  ].join('\n');
}

/** Rappel de méthode (app web ChatGPT) affiché dans la modale. */
export const METHOD_NOTE =
  'Fais 1 « ancre » parfaite (un asset repère au bon style), puis pour CHAQUE asset suivant JOINS l’ancre et colle la ' +
  '« variante cohérence » (change seulement l’objet). Vérifie le fond TRANSPARENT réel (pas de damier, pas de carte ' +
  'blanche/grise). Ré-uploade l’ancre tous les ~6 assets pour éviter la dérive. Si un asset refuse le transparent ' +
  'après 2 essais, passe-le dans remove.bg.';

/** Nom de fichier normalisé (minuscules, sans espace, .png). */
export function fileName(a: Asset): string {
  return `${a.id}.png`;
}

/* ---------- Le catalogue ---------- */
const A = (
  id: string,
  label: string,
  category: string,
  desc: string,
  kind: AssetKind = 'prop',
): Asset => ({ id, label, category, kind, desc });

export const ASSETS: Asset[] = [
  // ===== PORTES & FENÊTRES (objets muraux) =====
  A(
    'fenetre',
    'Fenêtre',
    'ouvertures',
    'a cozy square window with a wooden frame and light curtains',
    'wallprop',
  ),
  A(
    'fenetre-ronde',
    'Fenêtre ronde',
    'ouvertures',
    'a cute round porthole-style window with a wooden frame',
    'wallprop',
  ),
  A(
    'baie-vitree',
    'Baie vitrée',
    'ouvertures',
    'a large glass sliding bay window with a slim wooden frame',
    'wallprop',
  ),
  A(
    'porte-bois',
    'Porte en bois',
    'ouvertures',
    'a cute wooden door with a round knob',
    'wallprop',
  ),
  A(
    'porte-vitree',
    'Porte vitrée',
    'ouvertures',
    'a wooden door with a glass upper panel',
    'wallprop',
  ),

  // ===== CHAMBRE =====
  A(
    'lit-simple',
    'Lit simple',
    'chambre',
    'small cozy single bed with a cream duvet and one pillow',
  ),
  A(
    'lit-double',
    'Lit double',
    'chambre',
    'plush double bed with a sage quilt and two soft pillows',
  ),
  A(
    'lit-baldaquin',
    'Lit à baldaquin',
    'chambre',
    'cute four-poster canopy bed with light gauzy dusty-rose drapes',
  ),
  A('table-de-nuit', 'Table de nuit', 'chambre', 'small wooden bedside nightstand with one drawer'),
  A('commode', 'Commode', 'chambre', 'wooden chest of drawers with round knobs'),
  A('armoire', 'Armoire', 'chambre', 'tall wooden wardrobe with two doors'),
  A(
    'coiffeuse',
    'Coiffeuse',
    'chambre',
    'vanity dressing table with an oval mirror and a small stool',
  ),
  A(
    'lampe-chevet',
    'Lampe de chevet',
    'chambre',
    'small bedside table lamp with a warm cream shade',
  ),
  A(
    'etagere-livres',
    'Étagère à livres',
    'chambre',
    'a wall-mounted shelf with a few colorful books and a plant',
    'wallprop',
  ),
  A('coffre-jouets', 'Coffre à jouets', 'chambre', 'wooden toy chest with a rounded lid'),
  A(
    'tapis-rond',
    'Tapis rond',
    'chambre',
    'round woven area rug with concentric rings in cream, honey and sage',
    'rug',
  ),

  // ===== SALON =====
  A('canape', 'Canapé', 'salon', 'plump two-seat sofa in dusty-rose fabric with soft cushions'),
  A('fauteuil', 'Fauteuil', 'salon', 'cozy rounded armchair in sage fabric'),
  A('table-basse', 'Table basse', 'salon', 'small round wooden coffee table'),
  A('meuble-tv', 'Meuble TV', 'salon', 'low wooden TV console/cabinet'),
  A(
    'television',
    'Télévision',
    'salon',
    'chunky retro television set with rounded corners and antennae',
  ),
  A('bibliotheque', 'Bibliothèque', 'salon', 'tall wooden bookshelf filled with colorful books'),
  A('lampadaire', 'Lampadaire', 'salon', 'tall floor lamp with a warm cream shade'),
  A('cheminee', 'Cheminée', 'salon', 'cozy brick fireplace with a small warm fire'),
  A(
    'plante-salon',
    'Plante d’intérieur',
    'salon',
    'leafy potted monstera houseplant in a terracotta pot',
  ),
  A(
    'horloge-murale',
    'Horloge murale',
    'salon',
    'a round vintage wall clock with a wooden rim',
    'wallprop',
  ),
  A(
    'tapis-salon',
    'Tapis rectangulaire',
    'salon',
    'rectangular woven rug with a soft geometric pattern in warm pastels',
    'rug',
  ),

  // ===== CUISINE =====
  A(
    'plan-travail',
    'Plan de travail',
    'cuisine',
    'wooden kitchen counter with a small cream countertop',
  ),
  A('evier', 'Évier', 'cuisine', 'kitchen sink cabinet with a metal faucet'),
  A(
    'cuisiniere',
    'Cuisinière',
    'cuisine',
    'retro cream kitchen stove with four burners and an oven',
  ),
  A('frigo', 'Réfrigérateur', 'cuisine', 'rounded retro refrigerator in soft mint green'),
  A('table-cuisine', 'Table de cuisine', 'cuisine', 'small round wooden kitchen table'),
  A('chaise-cuisine', 'Chaise', 'cuisine', 'small wooden dining chair with a sage cushion'),
  A(
    'placard-haut',
    'Placard mural',
    'cuisine',
    'a wall-mounted wooden kitchen cupboard',
    'wallprop',
  ),
  A('micro-ondes', 'Micro-ondes', 'cuisine', 'small cream microwave oven'),
  A(
    'ilot-central',
    'Îlot central',
    'cuisine',
    'kitchen island with a butcher-block top and two stools',
  ),
  A(
    'etagere-epices',
    'Étagère à épices',
    'cuisine',
    'a small wall-mounted spice shelf with tiny colorful jars',
    'wallprop',
  ),

  // ===== BUREAU =====
  A('bureau', 'Bureau', 'bureau', 'wooden writing desk with a drawer'),
  A('chaise-bureau', 'Chaise de bureau', 'bureau', 'cute rolling office chair in sage'),
  A(
    'ordinateur',
    'Ordinateur',
    'bureau',
    'chunky retro desktop computer with a rounded monitor and keyboard',
  ),
  A('lampe-bureau', 'Lampe de bureau', 'bureau', 'articulated desk lamp in soft brass'),
  A('tableau-blanc', 'Tableau blanc', 'bureau', 'small white board on an easel with cute doodles'),
  A('globe', 'Globe terrestre', 'bureau', 'small desk globe on a wooden stand'),
  A('pile-livres', 'Pile de livres', 'bureau', 'small neat stack of colorful books'),
  A('plante-bureau', 'Petite plante', 'bureau', 'tiny succulent in a small terracotta pot'),
  A('corbeille', 'Corbeille', 'bureau', 'small woven waste basket'),
  A(
    'bibliotheque-bureau',
    'Étagère bureau',
    'bureau',
    'compact wooden shelf unit with books and boxes',
  ),

  // ===== DÉCO & ACCESSOIRES =====
  A('coussin', 'Coussin', 'deco', 'soft square throw cushion in dusty rose'),
  A(
    'guirlande',
    'Guirlande lumineuse',
    'deco',
    'a string of warm fairy lights (small bulbs) to hang on a wall',
    'wallprop',
  ),
  A('bougie', 'Bougie', 'deco', 'chunky lit candle on a small saucer'),
  A('vase-fleurs', 'Vase de fleurs', 'deco', 'ceramic vase with a small bouquet of pastel flowers'),
  A('miroir', 'Miroir', 'deco', 'oval standing mirror with a wooden frame'),
  A(
    'cadre-photo',
    'Cadre photo',
    'deco',
    'a small framed picture with a cute landscape, to hang on a wall',
    'wallprop',
  ),
  A(
    'tableau-art',
    'Tableau',
    'deco',
    'a framed wall painting of soft rolling hills, to hang on a wall',
    'wallprop',
  ),
  A(
    'plante-suspendue',
    'Plante suspendue',
    'deco',
    'a hanging planter with trailing green vines, to hang on a wall',
    'wallprop',
  ),
  A('pouf', 'Pouf', 'deco', 'round soft pouf/ottoman in mustard'),
  A('panier-osier', 'Panier en osier', 'deco', 'woven wicker storage basket'),
  A('aquarium', 'Aquarium', 'deco', 'small round fishbowl with one cute orange fish and a plant'),
  A(
    'horloge-coucou',
    'Horloge coucou',
    'deco',
    'a cute cuckoo wall clock in carved honey wood, to hang on a wall',
    'wallprop',
  ),

  // ===== JARDIN (extérieur) =====
  A('banc-jardin', 'Banc de jardin', 'jardin', 'wooden garden bench'),
  A(
    'table-pique-nique',
    'Table de pique-nique',
    'jardin',
    'wooden picnic table with attached benches',
  ),
  A('barbecue', 'Barbecue', 'jardin', 'round charcoal barbecue grill on legs'),
  A('balancoire', 'Balançoire', 'jardin', 'simple wooden swing hanging from a frame'),
  A('cabane-oiseaux', 'Nichoir', 'jardin', 'cute little wooden birdhouse on a post'),
  A('arrosoir', 'Arrosoir', 'jardin', 'metal watering can in soft mint'),
  A('brouette', 'Brouette', 'jardin', 'small wooden wheelbarrow with soil and a plant'),
  A(
    'pot-fleurs-ext',
    'Jardinière',
    'jardin',
    'long terracotta planter box full of colorful flowers',
  ),
  A(
    'lampadaire-jardin',
    'Lanterne de jardin',
    'jardin',
    'cute vintage garden lamp post with a warm glow',
  ),
  A('bac-a-sable', 'Bac à sable', 'jardin', 'small square wooden sandbox with a bucket and spade'),
  A('puits', 'Puits', 'jardin', 'small stone wishing well with a little wooden roof'),
  A('cabanon', 'Cabanon de jardin', 'jardin', 'tiny wooden garden shed with a pitched roof'),
  A('cloture-bois', 'Clôture bois', 'jardin', 'a low honey-wood picket fence segment'),
  A('haie', 'Haie', 'jardin', 'a neat green hedge segment'),

  // ===== PLAGE (extérieur) =====
  A('parasol', 'Parasol', 'plage', 'striped cream-and-coral beach umbrella/parasol'),
  A('transat', 'Transat', 'plage', 'wooden-and-canvas beach lounge chair'),
  A('chateau-sable', 'Château de sable', 'plage', 'cute little sandcastle with a tiny flag'),
  A('ballon-plage', 'Ballon de plage', 'plage', 'colorful striped beach ball'),
  A('seau-pelle', 'Seau et pelle', 'plage', 'small beach bucket with a spade, in bright pastels'),
  A('serviette-plage', 'Serviette de plage', 'plage', 'striped beach towel laid flat', 'rug'),
  A('bouee', 'Bouée', 'plage', 'round inflatable swim ring in coral and cream'),
  A('palmier', 'Palmier', 'plage', 'small cute palm tree with a curved trunk'),
  A('coquillage', 'Coquillage', 'plage', 'pretty spiral seashell'),
  A('glaciere', 'Glacière', 'plage', 'small cooler box in mint with a handle'),
  A(
    'planche-surf',
    'Planche de surf',
    'plage',
    'cute surfboard standing upright with a pastel wave pattern',
  ),
  A('cabine-plage', 'Cabine de plage', 'plage', 'tiny striped wooden beach changing hut'),

  // ===== NATURE & PLANTES (extérieur) =====
  A('arbre-rond', 'Arbre rond', 'nature', 'cute round-canopy deciduous tree with a stout trunk'),
  A('sapin', 'Sapin', 'nature', 'cute little pine/fir tree'),
  A('buisson', 'Buisson', 'nature', 'small round green bush'),
  A('fleur-tulipe', 'Tulipes', 'nature', 'small cluster of colorful tulips'),
  A('tournesol', 'Tournesol', 'nature', 'single cheerful sunflower'),
  A('cactus', 'Cactus', 'nature', 'cute round cactus in a small pot with a tiny flower'),
  A('champignon', 'Champignon', 'nature', 'cute red-and-white spotted toadstool mushroom'),
  A('rocher', 'Rocher', 'nature', 'smooth rounded grey boulder with a little moss'),
  A('souche', 'Souche', 'nature', 'small tree stump with rings on top'),
  A('nenuphar', 'Nénuphar', 'nature', 'lily pad with a small pink water flower', 'rug'),
  A('bambou', 'Bambou', 'nature', 'small cluster of green bamboo stalks'),
  A(
    'bosquet-fleurs',
    'Massif de fleurs',
    'nature',
    'small flower bed patch with mixed pastel blooms',
  ),

  // ===== OBJETS & ITEMS =====
  A('ballon', 'Ballon', 'objets', 'shiny party balloon on a string'),
  A('livre-magique', 'Livre', 'objets', 'thick closed storybook with a golden clasp'),
  A('cle', 'Clé', 'objets', 'cute old-fashioned brass key'),
  A('cadeau', 'Cadeau', 'objets', 'wrapped gift box with a big ribbon bow'),
  A('trophee', 'Trophée', 'objets', 'small golden trophy cup'),
  A('medaille', 'Médaille', 'objets', 'round gold medal on a ribbon'),
  A('potion', 'Potion', 'objets', 'cute round potion bottle with glowing pastel liquid'),
  A('piece-or', 'Pièce d’or', 'objets', 'shiny round gold coin with a star engraving'),
  A('cristal', 'Cristal', 'objets', 'faceted pastel gemstone crystal'),
  A('coeur', 'Cœur', 'objets', 'plump glossy red heart icon'),
  A('etoile', 'Étoile', 'objets', 'chunky cute five-point star, soft yellow'),
  A('cloche', 'Clochette', 'objets', 'small golden hand bell'),

  // ===== NOURRITURE =====
  A('pomme', 'Pomme', 'nourriture', 'shiny red apple with a leaf'),
  A('gateau', 'Gâteau', 'nourriture', 'slice of layered cake with cream frosting and a cherry'),
  A('cupcake', 'Cupcake', 'nourriture', 'cupcake with swirled pastel frosting and sprinkles'),
  A('part-pizza', 'Part de pizza', 'nourriture', 'single cheesy pizza slice'),
  A('glace-cornet', 'Glace', 'nourriture', 'ice cream cone with two pastel scoops'),
  A('biscuit', 'Biscuit', 'nourriture', 'round chocolate-chip cookie'),
  A(
    'bol-nouilles',
    'Bol de nouilles',
    'nourriture',
    'steaming bowl of ramen noodles with chopsticks',
  ),
  A('sushi', 'Sushi', 'nourriture', 'cute pair of nigiri sushi pieces'),
  A('croissant', 'Croissant', 'nourriture', 'golden flaky croissant'),
  A(
    'chocolat-chaud',
    'Chocolat chaud',
    'nourriture',
    'mug of hot chocolate with whipped cream and marshmallows',
  ),
  A('fraise', 'Fraise', 'nourriture', 'plump red strawberry'),
  A('carotte', 'Carotte', 'nourriture', 'cute orange carrot with green leafy top'),

  // ===== ESPACE DE TRAVAIL (open-space entreprise) =====
  A(
    'bureau-travail',
    'Bureau',
    'travail',
    'modern office desk with a light wood top and slim metal legs',
  ),
  A(
    'chaise-bureau-pro',
    'Chaise de bureau (pro)',
    'travail',
    'ergonomic office swivel chair on castors, sage mesh back',
  ),
  A(
    'ordinateur-pro',
    'Ordinateur (pro)',
    'travail',
    'desktop computer with a flat monitor, keyboard and mouse',
  ),
  A('double-ecran', 'Double écran', 'travail', 'dual-monitor computer setup on a desk stand'),
  A(
    'ordinateur-portable',
    'Ordinateur portable',
    'travail',
    'open laptop computer with a glowing screen',
  ),
  A('imprimante', 'Imprimante', 'travail', 'small office printer with a paper tray'),
  A('photocopieuse', 'Photocopieuse', 'travail', 'large office copier / multifunction printer'),
  A('armoire-dossiers', 'Armoire à dossiers', 'travail', 'metal filing cabinet with three drawers'),
  A('casier-employe', 'Casier', 'travail', 'tall column of metal employee lockers'),
  A('cloison-bureau', 'Cloison de bureau', 'travail', 'grey fabric cubicle partition panel'),
  A(
    'fontaine-eau',
    'Fontaine à eau',
    'travail',
    'office water cooler with an upside-down blue bottle',
  ),
  A('corbeille-papier', 'Corbeille à papier', 'travail', 'small metal mesh waste-paper bin'),
  A(
    'pile-dossiers',
    'Pile de dossiers',
    'travail',
    'neat stack of colorful paper folders and documents',
  ),
  A(
    'telephone-bureau',
    'Téléphone de bureau',
    'travail',
    'retro office desk phone with a coiled cord',
  ),
  A(
    'lampe-bureau-pro',
    'Lampe de bureau (pro)',
    'travail',
    'adjustable desk task lamp in soft cream',
  ),
  A(
    'serveur-informatique',
    'Serveur informatique',
    'travail',
    'small server rack tower with blinking status lights',
  ),
  A('projecteur', 'Vidéoprojecteur', 'travail', 'compact ceiling-style video projector'),
  A(
    'plante-bureau-pro',
    'Plante de bureau (haute)',
    'travail',
    'tall potted office plant in a minimalist white pot',
  ),
  A(
    'tableau-blanc-mural',
    'Tableau blanc (mural)',
    'travail',
    'a wall-mounted whiteboard with a marker tray and faint sketches',
    'wallprop',
  ),
  A(
    'tableau-liege',
    'Tableau en liège',
    'travail',
    'a cork pin-board with sticky notes and pinned papers',
    'wallprop',
  ),
  A(
    'horloge-bureau',
    'Horloge de bureau',
    'travail',
    'a plain round office wall clock',
    'wallprop',
  ),
  A('extincteur', 'Extincteur', 'travail', 'a red wall-mounted fire extinguisher', 'wallprop'),
  A('panneau-sortie', 'Panneau sortie', 'travail', 'a green illuminated EXIT sign', 'wallprop'),

  // ===== CANTINE (entreprise) =====
  A('table-cantine', 'Table de cantine', 'cantine', 'long canteen table with attached bench seats'),
  A(
    'distributeur-boissons',
    'Distributeur de boissons',
    'cantine',
    'tall vending machine full of colorful drink cans',
  ),
  A(
    'distributeur-snacks',
    'Distributeur de snacks',
    'cantine',
    'snack vending machine with spiral shelves',
  ),
  A(
    'machine-cafe',
    'Machine à café',
    'cantine',
    'office coffee machine dispensing into a small cup',
  ),
  A('micro-ondes-cantine', 'Micro-ondes (cantine)', 'cantine', 'small white microwave oven'),
  A('refrigerateur-cantine', 'Réfrigérateur', 'cantine', 'tall cream double-door fridge'),
  A(
    'comptoir-self',
    'Comptoir self-service',
    'cantine',
    'stainless self-service canteen counter with a food tray rail',
  ),
  A('plateau-repas', 'Plateau-repas', 'cantine', 'canteen meal tray with a plate, cup and cutlery'),
  A('poubelle-tri', 'Poubelles de tri', 'cantine', 'row of three colored recycling sorting bins'),
  A(
    'menu-mural',
    'Menu mural',
    'cantine',
    'a wall menu board with a simple daily menu',
    'wallprop',
  ),

  // ===== TOILETTES (entreprise / sanitaires) =====
  A('wc-cuvette', 'Cuvette WC', 'sanitaires', 'clean white toilet bowl with a cistern'),
  A(
    'cabine-wc',
    'Cabine WC',
    'sanitaires',
    'toilet stall cubicle with a light partition and a door',
  ),
  A('lavabo', 'Lavabo', 'sanitaires', 'white wall basin sink with a chrome tap'),
  A('urinoir', 'Urinoir', 'sanitaires', 'wall-mounted white urinal', 'wallprop'),
  A(
    'miroir-toilettes',
    'Miroir',
    'sanitaires',
    'a rectangular wall mirror with a slim frame',
    'wallprop',
  ),
  A('seche-mains', 'Sèche-mains', 'sanitaires', 'a wall-mounted electric hand dryer', 'wallprop'),
  A(
    'distributeur-savon',
    'Distributeur de savon',
    'sanitaires',
    'a small wall soap dispenser',
    'wallprop',
  ),
  A(
    'distributeur-papier',
    'Distributeur de papier',
    'sanitaires',
    'a wall paper-towel dispenser',
    'wallprop',
  ),
  A('poubelle-toilettes', 'Poubelle', 'sanitaires', 'small pedal waste bin'),

  // ===== ESPACE DE REPOS =====
  A('canape-repos', 'Canapé lounge', 'repos', 'low modern lounge sofa in soft teal fabric'),
  A('pouf-repos', 'Pouf', 'repos', 'round squishy bean-bag pouf in mustard yellow'),
  A('baby-foot', 'Baby-foot', 'repos', 'foosball table with little colored player figures'),
  A('billard', 'Billard', 'repos', 'small pool / billiard table with green felt and colored balls'),
  A(
    'borne-arcade',
    'Borne d’arcade',
    'repos',
    'retro upright arcade cabinet with a glowing screen',
  ),
  A(
    'table-ping-pong',
    'Table de ping-pong',
    'repos',
    'blue ping-pong table with a net and two paddles',
  ),
  A('machine-cafe-repos', 'Coin café', 'repos', 'cozy coffee corner stand with a machine and mugs'),
  A('plante-repos', 'Grande plante', 'repos', 'large leafy potted palm plant in a woven basket'),

  // ===== GARAGE & PARKING =====
  A(
    'voiture',
    'Voiture',
    'garage',
    'cute rounded compact car, pastel teal, seen at the isometric angle',
  ),
  A('camionnette', 'Camionnette', 'garage', 'small rounded delivery van, cream colored'),
  A('velo-parking', 'Range-vélos', 'garage', 'metal bike rack with one parked bicycle'),
  A(
    'borne-recharge',
    'Borne de recharge',
    'garage',
    'electric-car charging station pillar with a cable',
  ),
  A('etabli-garage', 'Établi', 'garage', 'wooden workbench with a few tools and a vice'),
  A('caisse-outils', 'Caisse à outils', 'garage', 'red metal tool box with a handle'),
  A('bidon-huile', 'Bidon d’huile', 'garage', 'blue metal oil drum barrel'),
  A('pile-pneus', 'Pile de pneus', 'garage', 'stack of three black car tires'),
  A(
    'plot-signalisation',
    'Cône de signalisation',
    'garage',
    'orange and white traffic safety cone',
  ),
  A(
    'place-parking',
    'Place de parking',
    'garage',
    'painted parking space floor markings, white lines on grey asphalt',
    'rug',
  ),
  A(
    'panneau-parking',
    'Panneau parking',
    'garage',
    'a blue square P parking sign on a post',
    'wallprop',
  ),
];

export function assetsByCategory(catId: string): Asset[] {
  return ASSETS.filter((a) => a.category === catId);
}
