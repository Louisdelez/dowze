# La crise du diplôme : le paradoxe 85 % / 1-sur-700

> *Le diplôme est en train de lâcher comme signal de compétence — mais rien ne le remplace encore. C'est
> précisément le vide que comble le [Passeport Dowze](../03-ARCHITECTURE/05-preuve-passeport.md).*

---

## Le paradoxe central

Deux faits, apparemment contradictoires, cohabitent en 2024-2026 :

- **Côté discours** : environ **85 %** des employeurs déclarent vouloir recruter « sur les compétences »
  ; ~52 % des offres d'emploi américaines n'exigent plus de diplôme (vs ~48 % en 2019) ; 25 États
  américains ont retiré l'exigence de diplôme de postes publics en 2024.
- **Côté réalité** : dans les grandes entreprises ayant *pourtant* retiré l'exigence de diplôme, **moins
  d'1 embauche sur 700** concerne réellement une personne sans diplôme.

Ce chiffre vient du rapport **Burning Glass Institute + Harvard Business School** (Joseph Fuller),
*Skills-Based Hiring: The Long Road from Pronouncements to Practice* (14 février 2024), qui a analysé
~11 300 rôles sur 2014-2023. Précisément :

- ~**97 000 travailleurs** sur ~**77 millions d'embauches** annuelles ont réellement bénéficié de
  l'abandon des exigences de diplôme = **< 1 sur 700**.
- Là où les exigences ont été levées, la part de travailleurs sans diplôme n'a augmenté que de
  **+3,5 points** en moyenne ; rapporté à l'ensemble, l'effet net n'est que de **+0,14 point**.
- Typologie des entreprises : **37 %** « leaders » (changement réel), **45 %** « in-name-only » (annonce
  sans effet), **18 %** « backsliders » (gains éphémères puis retour en arrière).

> **L'intention est massive ; l'effet réel est marginal.** Le « skills-based hiring » reste, pour
> l'essentiel, **performatif**.

---

## Pourquoi le diplôme survit malgré tout

Ce n'est pas parce qu'il est *bon*. C'est parce qu'il **manque une couche d'infrastructure de
confiance**. Sans diplôme, l'employeur n'a aujourd'hui aucun moyen *fiable, standardisé et rapide* de
vérifier qu'une personne sait faire. Le diplôme survit comme un **proxy par défaut**, faute de mieux.

C'est un problème d'**infrastructure**, pas de bonne volonté. Et un problème d'infrastructure se résout
par… de l'infrastructure. C'est exactement le rôle du Passeport vérifiable : fournir le remplaçant qui
manque.

---

## Le contexte : dévaluation et « plafond de papier »

- **Degree inflation** (*Dismissed by Degrees*, HBS/Accenture/Grads of Life, 2017) : analyse de 26
  millions d'offres. Jusqu'à **6 millions d'emplois** potentiellement fermés aux non-diplômés par une
  exigence injustifiée. Exemple emblématique : 67 % des offres de « production supervisor » exigent un
  diplôme, contre 16 % des titulaires en poste.
- **« Tear the Paper Ceiling »** (Opportunity@Work + Ad Council, depuis 2022) : mouvement autour des
  **STARs** (*Skilled Through Alternative Routes*) — environ **70 millions de travailleurs américains**
  compétents par des voies alternatives, bloqués par l'exigence de diplôme.

> ⚠️ Le « 70 millions de STARs » est une estimation de plaidoyer (solide statistiquement mais mobilisée
> militairement) ; *Dismissed by Degrees* a presque 10 ans. À utiliser pour le diagnostic, pas comme
> preuve d'un changement de pratique — le rapport 2024 montre justement que le diagnostic *n'a pas*
> conduit au changement.

---

## Ce que valent (vraiment) les alternatives actuelles au diplôme

| Alternative | Adoption | Valeur réelle | Verdict |
|-------------|----------|---------------|---------|
| **Micro-certifications** (Google Career Certificates…) | Massive (>2,3 M inscrits Google ; >20 M Coursera) | Effet **indépendant modeste** : +6 % d'emploi, +8 % d'emplois liés (étude arXiv 2024) | Adoption mûre, **ROI survalorisé** par les fournisseurs |
| **Open Badges** (1EdTech, 74,8 M émis en 2022) | Mûre | Dépend entièrement de la **réputation de l'émetteur** | Brique technique solide, mais « inflation de badges » |
| **Portfolios** (GitHub, Behance) | Pratique mûre, non standardisée | Preuve *directe* puissante… | …mais **aucune identité ni couche de confiance** (un dépôt copié n'est pas une preuve) |

> ⚠️ Les chiffres à 90+ % de valorisation des micro-credentials (« 94 % des employeurs paieraient plus »)
> proviennent des **fournisseurs eux-mêmes** (Coursera), en conflit d'intérêt. À ne pas citer comme
> preuve. Les données indépendantes donnent des effets bien plus modestes.

---

## La leçon pour Dowze

Le marché a déjà identifié les bonnes briques (badges signés, portfolios, preuve par le travail) mais ne
les a pas assemblées en une **couche de confiance** complète. Une preuve de compétence crédible doit
combiner :

1. **Authenticité cryptographique** (le credential vient bien de qui il prétend) — mûr : Open Badges 3.0 /
   W3C Verifiable Credentials 2.0 (voir [specs Passeport](../05-TECHNIQUE/04-passeport-verifiable-specs.md)) ;
2. **Validité de l'apprentissage** (la personne sait vraiment) — par la **preuve de travail réel** et la
   vérification multi-source, plus fiable qu'un simple QCM surveillé ;
3. **Identité** (c'est bien cette personne) — vérifiée pour les enjeux élevés ;
4. **Possession par l'apprenant** (portable, non confisquable).

C'est l'objet de la couche [Preuve / Passeport](../03-ARCHITECTURE/05-preuve-passeport.md).

---

## Sources

- Burning Glass Institute & HBS (2024). *Skills-Based Hiring: The Long Road from Pronouncements to
  Practice*.
- HBS Institute for Business in Global Society (2024). *Fewer than 1 in 700 get hired without a college
  degree*.
- HBS/Accenture/Grads of Life (2017). *Dismissed by Degrees*.
- Opportunity@Work. *Tear the Paper Ceiling* / STARs.
- *The Value of Non-Traditional Credentials in the Labor Market* (arXiv 2024).

Détail en [bibliographie](../09-ANNEXES/01-bibliographie.md).
