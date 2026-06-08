# Système parental & modération — la sécurité sans brider personne

> *L'école du futur est **pour tout le monde, la même pour tous**. On ne **bride pas** les mineurs à cause
> de quelques personnes toxiques : ils ont **exactement les mêmes fonctionnalités** que les autres. La
> sécurité vient de **deux piliers** — un **système parental** (à la Pronote) et une **modération forte**
> (bots à la Discord + modérateurs humains) — **pas de la restriction**.*

> ⚠️ Ce document **remplace** l'approche « jardin clos qui restreint les mineurs » des versions précédentes
> ([04-securite-cold-start](04-securite-cold-start.md) et [05 §5](05-classes-et-communication.md) sont
> réalignés sur ce modèle).

---

## Le principe

| ❌ Ancien (rejeté) | ✅ Modèle retenu |
|--------------------|------------------|
| Brider les mineurs (pas de DM, pas de visio…) | **Mêmes fonctionnalités pour tous** |
| Sécurité = restriction | Sécurité = **modération + suivi parental** |
| L'élève « paie » pour les toxiques | Les **modérateurs et les bots** gèrent les toxiques |

> Une personne toxique se fait **modérer** ; elle ne fait pas perdre des fonctionnalités à tous les autres.

---

## PARTIE 1 — Le système parental (à la Pronote)

### 1. À l'inscription : l'email du responsable légal
Quand un **mineur** crée un compte, il saisit l'**email de son responsable légal**. On obtient un
**consentement parental vérifiable** (exigé par COPPA / RGPD) par la méthode **« email plus »** : un email
au parent + une **double confirmation** (2ᵉ étape différée). Preuve **horodatée** conservée. Seuil d'âge
**selon la juridiction** : COPPA 13 ans (US), **France 15 ans**, UE 16 par défaut.

### 2. Le compte parent (optionnel) — un tableau de bord de suivi
Le responsable légal **peut créer son propre compte** (identifiants propres, **jamais** le mot de passe de
l'enfant ; 1 élève ↔ N responsables, comme Pronote). Il y suit :

- la **progression** et les compétences,
- le **planning**,
- les **auto-évaluations**,
- la **présence / les absences** (auto-marquées, cf. [planning & régularité](../11-planning-regularite.md)),
- une **synthèse de l'activité communautaire** (volume, ton général, incidents éventuels).

> ⚠️ **Suivi, pas surveillance.** La recherche est nette : la supervision **restrictive** *augmente* l'usage
> problématique et dégrade la confiance ; l'**« active mediation »** (dialogue, transparence) marche. Donc :
> on **ne montre jamais au parent le contenu brut des messages privés** par défaut — seulement la synthèse
> et les **incidents modérés**. La transparence est **visible par l'ado** (« ton responsable voit X »), et
> **graduée selon l'âge** (un ado de 16 ans a plus d'espace privé qu'un enfant de 9 ans).

### 3. Sans compte parent : le bilan par email
Si le parent ne crée **pas** de compte, il reçoit un **bilan périodique par email** (hebdomadaire par
défaut, quotidien/mensuel possible) : progression de la semaine, planning à venir, assiduité,
auto-évaluations, **1 point fort + 1 point à améliorer (actionnable)**, et un lien pour créer un compte
complet.

> **Preuve forte** : un message hebdomadaire individualisé prof→parent a réduit l'échec scolaire de
> **15,8 % à 9,3 % (−41 %)**, surtout en prévenant les abandons (Kraft & Rogers, Harvard, 2015). Le bilan
> email est le **chemin minimal garanti** : tout responsable l'a, le dashboard est l'option en plus.

### 4. Les alertes rapides (gradué)
| Niveau | Déclencheur | Action |
|--------|-------------|--------|
| **Routine** | activité normale | → dans le **digest** |
| **Modéré** | l'enfant a posté/reçu du contenu toxique | → notification dashboard + récap email |
| **Grave** | **harcèlement caractérisé, signal de détresse** | → **alerte urgente email + push** au responsable **+** escalade modérateur humain **+** orientation de l'enfant vers de l'aide |

⚠️ Une alerte « grave » est **toujours validée par un humain** avant l'envoi (anti faux positif). Cas
sensible : si le **foyer** peut être la source du mal-être, prévoir un **canal d'aide indépendant du parent**.

---

## PARTIE 2 — La modération (à la Discord)

La sécurité de tous repose sur une modération **forte et multi-couches**, identique pour tout le monde.

### 5. Les bots de modération (AutoMod, modèle Discord)
Couche 1, **toujours active** : filtres **mots-clés + regex** (anti-contournement type leetspeak),
détection de **spam**, **mention-spam**, filtrage des **pseudos/profils**. Actions **graduées** : bloquer le
message avant publication / alerter le canal de modération / **mute temporaire** / **escalader**. **Tout est
journalisé.** (C'est exactement le modèle AutoMod de Discord : déclencheurs + actions automatiques.)

### 6. La détection de toxicité — bidirectionnelle
Couche 2, **ML** (modèle multilingue type OpenAI Moderation `omni` — on **ne dépend pas** de Perspective
API seul, dont l'arrêt est annoncé fin 2026). On score chaque message **dans les deux sens** :

- côté **émetteur** : cet utilisateur **insulte / harcèle** ;
- côté **destinataire** : cet utilisateur **reçoit** un volume/une intensité de toxicité → **potentielle
  victime de harcèlement** (cumul sur une fenêtre de temps, pas un message isolé).

> ⚠️ **Honnêteté** : ces modèles ont des **faux positifs et des biais** (ils sur-scorent l'anglais
> afro-américain, les termes LGBTQ+ réappropriés, le langage informel des jeunes). Donc le ML sert à
> **prioriser et escalader, jamais à bannir automatiquement**. On **calibre et on audite les biais** pour
> ne pas pénaliser injustement un élève.

### 7. Les modérateurs humains (qui tranchent)
Couche 3 : une **file de modération à tiers de risque** (le sûr est auto-validé ; l'incertain et le grave
montent vite ; les **signalements communautaires** et l'**historique** des récidivistes augmentent la
priorité). Des **modérateurs humains** (rôles gradués : modérateur → senior → admin) **tranchent** les cas
gris et sensibles — l'IA apporte la vitesse, l'humain le jugement, le contexte et l'empathie. On prévoit le
**bien-être des modérateurs** (exposition à du contenu difficile).

### 8. Le pont modération → parents (pour les mineurs)
Quand un **mineur** est impliqué — **qu'il soit auteur OU victime** — et que l'incident est grave, après
**validation humaine** : **alerte au responsable légal** (Partie 1 §4), consignée dans le dashboard/digest.

- *Exemple « auteur »* : un mineur se met à **insulter tout le monde** → modéré (avertissement/mute) **+**
  email au parent pour l'avertir.
- *Exemple « victime »* : un mineur **reçoit des insultes / est harcelé** → l'agresseur est modéré **+** le
  parent de la victime est averti **en urgence**.
- *Cas détresse / auto-mutilation* : **escalade humaine immédiate** + **orientation vers des ressources
  d'aide** + alerte parent — **jamais** d'action 100 % automatique sur ces cas.

---

## Pourquoi c'est la bonne approche

- **Égalité** : l'expérience est **identique pour tous** (mineurs inclus) — DM, visio, communauté, tout.
- **Sécurité réelle** : la toxicité est traitée par les **bots + les modérateurs** (comme Discord), et les
  parents ont un **suivi + des alertes** (comme Pronote) — deux filets, pas une cage.
- **Confiance** : le suivi parental est de l'**accompagnement** (synthèse + alertes), pas de l'espionnage
  (jamais le contenu privé brut par défaut), et il est **transparent** pour l'ado.
- **Conforme** : le consentement parental par email du responsable (« email plus ») satisfait COPPA/RGPD
  **sans** brider l'élève.

> Un point de réalité subsiste : la communauté de Dowze est composée de **membres inscrits** (classes,
> Guildes), pas d'inconnus aléatoires d'internet — ce qui réduit naturellement le risque « contact avec un
> inconnu » **sans retirer aucune fonctionnalité**. La sécurité vient du **cadre + la modération + le suivi
> parental**, jamais du bridage.

---

## Implémentation (rappel)

- **Comptes** : `guardian` lié à `student` (1↔N), consentement horodaté ; Supabase Auth + RLS.
- **Digest / alertes** : jobs **BullMQ** (email récap périodique, alertes urgentes), notifications.
- **Bots AutoMod** : règles mots-clés/regex/spam + actions graduées + journalisation.
- **ML toxicité** : pipeline de scoring bidirectionnel (OpenAI Moderation), file de modération à tiers.
- **Dashboard parent** : vues synthèse (jamais le contenu privé brut). Voir [backend](../14-backend.md).

**Sources** : Pronote / Index Education (espace parents) ; FTC COPPA / RGPD art. 8 (consentement « email
plus ») ; Kraft & Rogers 2015 (digest parental, −41 %) ; AAP & Cambridge Handbook (active mediation vs
surveillance) ; Discord AutoMod (API officielle) ; OpenAI Moderation / Perspective API (toxicité, biais,
sunset 2026) ; recherche modération hybride IA+humain ; Samaritans (détresse/auto-mutilation). Détail :
[bibliographie](../../09-ANNEXES/01-bibliographie.md).
