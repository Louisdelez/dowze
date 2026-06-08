# Comment apprendre avec Dowze, concrètement

> *L'école Dowze, au départ, c'est **une personne + une IA**. L'IA est ton **professeur particulier** :
> elle diagnostique ton niveau, **décide et te prescrit le programme**, te donne les cours adaptés — exactement
> comme quand tu entres au collège ou au lycée sans connaître le programme : **c'est le prof qui te dit quoi
> apprendre.** Tu n'as pas à le savoir d'avance.*
>
> *La **communauté d'autres élèves n'est pas un prérequis**. Au début il n'y en a pas, ou très peu. Elle se
> forme petit à petit et **amplifie** l'apprentissage — mais le système **fonctionne sans elle**, avec juste
> un abonnement IA.*

> 📚 **Ce que l'IA prescrit, c'est un cursus complet d'éducation générale** (le **tronc commun**), pas un
> sujet au hasard — comme le programme d'un collège/lycée. L'élève ne choisit qu'au moment de la
> **spécialisation**, bien plus tard. Détail du modèle : [le Cursus & la spécialisation](../03-ARCHITECTURE/07-cursus-et-specialisation.md)
> et le [parcours élève dans l'app](../10-APP-WEB/08-parcours-eleve.md).

---

## 1. Le principe : 1 personne + 1 IA

Pour apprendre avec Dowze, il faut **deux choses seulement** :

1. **Un abonnement à une IA** (Claude, ChatGPT, Gemini…).
2. **La méthode** : une **Charte** que l'élève lit, et un **Prompt-Maître** qu'on donne à l'IA pour qu'elle
   devienne l'école.

C'est tout. Pas de bâtiment, pas de prof humain, pas de cours préexistants, **pas besoin d'autres élèves**.
La communauté viendra plus tard, naturellement, quand d'autres rejoignent — mais elle est un **bonus**, pas
une fondation.

---

## 2. L'IA est ton prof : c'est elle qui te dit quoi apprendre

Le point central : **l'élève n'arrive pas en sachant le programme.** Comme un nouveau collégien, il ne sait
pas quoi apprendre ni dans quel ordre — et c'est **normal**. C'est le rôle du prof. Ici, l'IA joue ce rôle :

| Rôle de l'école | Ce que fait l'IA |
|-----------------|-------------------|
| 🩺 **Diagnostiquer** | Elle évalue ton niveau de départ par quelques questions. |
| 🗺️ **Prescrire le programme** | Elle décide quoi tu apprends et dans quel ordre (la carte des compétences). |
| 👩‍🏫 **Donner les cours** | Elle explique, te questionne, adapte le niveau, corrige. |
| 🎒 **Donner le travail** | Exercices et vraies quêtes (projets) pour appliquer. |
| 📈 **Suivre la progression** | Carnet de bord, révisions espacées, validation par la maîtrise. |

Et si tu **ne sais pas du tout** quoi apprendre, l'IA t'interroge (tes curiosités, un problème que tu veux
résoudre, un rêve, ton temps disponible) puis **te propose** 2-3 directions concrètes et t'en recommande
une. **Jamais de page blanche.**

> C'est pédagogiquement le plus solide : pour un **débutant**, on apprend mieux quand on lui *prescrit* le
> parcours que quand on le laisse choisir seul (Kirschner, Sweller & Clark, 2006 — le « guidage minimal »
> échoue pour les novices, car leur mémoire de travail sature). L'élève qui « ne sait pas quoi apprendre »
> est par définition un novice : lui prescrire le chemin est exactement ce qu'il faut.

---

## 3. Les deux conditions non négociables

La recherche est sans ambiguïté : ce modèle tient debout **à deux conditions**.

### Condition 1 — L'IA *pilote* le programme, elle ne l'*invente* pas
Un LLM laissé seul pour **fabriquer** un curriculum **hallucine, laisse des trous et fait des
incohérences** (étude « Don't Forget the Teachers », 2025 ; chez Alpha School, des plans de cours générés
par IA ont été jugés « plus de mal que de bien »). À l'inverse, les systèmes qui marchent (ALEKS, MATHia —
effets d ≈ 0,4 à 0,76) prescrivent le parcours sur une **carte de compétences/prérequis structurée** : ils
ne dessinent pas la carte, ils s'y déplacent.

→ **Donc** : l'IA doit bâtir le programme **sur des référentiels reconnus** du domaine (standards, plans
d'études, progressions existantes), pas à partir de rien. C'est le rôle de l'[Atlas](../03-ARCHITECTURE/01-atlas.md)
du projet : *l'IA prescrit sur une carte fiable, elle ne génère pas la carte au hasard.*

### Condition 2 — L'IA enseigne en *faisant penser*, pas en donnant les réponses
Seul avec une IA **non bridée** = **−17 %** d'apprentissage durable (Bastani et al., *PNAS* 2025). Avec
garde-fous (questions, scaffold-and-fade, valider en faisant) = **+0,7 à 1,3σ** (Kestin et al. 2025). La
variable décisive est le **design**, pas le modèle. Voir
[délestage cognitif](../07-RISQUES-ETHIQUE/02-delestage-cognitif.md).

---

## 4. Pourquoi ça tient **sans** communauté

La motivation repose sur **trois besoins** (théorie de l'autodétermination — méta-analyse Bureau et al.
2021, 144 études, N≈79 000) :

| Besoin | Poids dans la motivation | Qui le fournit |
|--------|--------------------------|----------------|
| **Compétence** (sentir qu'on progresse) | **43 %** — le plus fort | ✅ l'IA (feedback, difficulté juste) |
| **Autonomie** (choisir, contrôler) | **34 %** | ✅ l'IA (choix encadrés, rythme) |
| **Appartenance** (les autres élèves) | **22 %** — le plus faible | 🟡 la communauté, *plus tard* |

**Les deux leviers les plus puissants (compétence + autonomie) sont précisément ceux qu'une IA-tuteur sait
fournir.** L'appartenance — ce qu'apporte la communauté — est le levier le **plus faible**. Démarrer **sans**
communauté n'est donc pas une faille : c'est viable. Quand la communauté se forme, elle ajoute ce 22 % et
réduit le décrochage — un *amplificateur*, pas une fondation.

---

## 5. La preuve dans le monde réel — et ses limites

**Alpha School** (Austin, Texas) fait déjà presque ça : les élèves apprennent les fondamentaux en ~2h/jour
avec une IA/logiciel adaptatif, **sans profs**. Le modèle existe, tourne, et s'étend (~15 campus, expansion
2026). Donc l'idée n'est pas de la science-fiction.

Mais — honnêteté, comme dans toute la doc :
- **Aucune preuve indépendante** de leurs résultats spectaculaires (« top 1-2 % ») : chiffres internes, fort
  **biais de sélection** (familles à 40 000 $/an, très motivées).
- Même eux **gardent des humains** (« guides ») — non pour enseigner, mais pour la **motivation**.
- IXL (un de leurs outils) les a coupés en déclarant *« notre produit n'est pas un remplacement
  d'enseignant »* ; et des scandales données/vie privée ont éclaté.

**La leçon** : l'IA-prof *transmet* très bien ; ce qui coince, c'est la **persévérance dans la durée** et la
**confiance** — pas le savoir.

---

## 6. Le vrai risque du solo, et comment le tenir

Le point faible n'est ni le savoir ni la motivation immédiate, c'est :

- **La persévérance** : sans personne qui t'attend, on lâche plus facilement.
- **Pour les enfants** : l'absence d'adulte référent (sécurité, développement socio-émotionnel) est le point
  le moins défendable empiriquement.

Mitigations qui n'exigent **aucune** communauté :

- l'IA fournit la **structure** (objectifs hebdomadaires, carnet de bord, jalons de maîtrise) — c'est cela
  qui retient autant que le lien social ;
- le public de départ est **auto-sélectionné** : quelqu'un qui *choisit* de rejoindre est déjà motivé →
  démarrer solo cible exactement les bonnes personnes ;
- pour un **mineur**, garder au moins **un adulte référent léger** (un parent informé, un mentor à distance)
  est recommandé — ce n'est pas une communauté, juste une présence ;
- quand 1-2 autres élèves arrivent, la communauté **se greffe** et amplifie, sans avoir été nécessaire avant.

---

## 7. La Charte de l'Élève

À lire une fois. Chaque engagement découle d'un des
[12 principes fondateurs](../00-FONDATIONS/03-principes-fondateurs.md).

| Engagement | Fondement |
|------------|-----------|
| Je laisse l'IA me dire quoi apprendre (je n'ai pas à le savoir d'avance) | Guidage des novices (Kirschner 2006) |
| La maîtrise, pas le temps | Principe 1 |
| J'apprends en faisant | Principe 4 |
| L'IA me fait penser, pas à ma place | Principe 5 |
| Je prouve en faisant | Principe 6 |
| Je protège mon cerveau (je lutte contre la facilité) | Recherche — délestage cognitif |
| Je protège mon bien-être (sessions courtes, repos) | Principe 9 |
| Je tiens mon carnet de bord | Continuité |
| (Optionnel) Quand d'autres arrivent, je m'ouvre à la communauté | Principe 7 — l'humain amplifie |

---

## 8. Le Prompt-Maître « École Dowze »

À copier-coller intégralement dans l'IA. C'est lui qui la transforme en ton prof.

```
Tu es « Dowze », mon école et mon professeur particulier, piloté à 100 % par toi. Tu joues TOUS les rôles : tu diagnostiques mon niveau, tu DÉCIDES et tu me PRESCRIS le programme, tu donnes les cours adaptés à mon niveau, et tu suis ma progression — exactement comme un prof le fait quand un élève entre dans une école sans connaître le programme. Je n'ai PAS à savoir d'avance quoi apprendre : c'est TON rôle de me le dire. Le système doit fonctionner même si je suis seul (aucune communauté d'élèves n'est nécessaire). Suis ces règles sans exception.

PHILOSOPHIE
- La maîtrise, pas le temps : on ne passe à la suite que quand j'ai vraiment compris.
- J'apprends en FAISANT de vrais projets, pas en écoutant passivement.
- Tu me fais PENSER : tu questionnes, tu guides, mais tu ne fais jamais le travail à ma place.
- Je valide une compétence en la DÉMONTRANT moi-même.
- Bien-être : sessions courtes, une étape à la fois, pas de pavés indigestes.

ÉTAPE 0 — ACCUEIL & DIAGNOSTIC
- Présente-toi en 2 lignes. Dis-moi clairement que je n'ai pas besoin de savoir quoi apprendre : tu vas me guider.
- Demande-moi si j'ai déjà une idée de ce que je veux apprendre.
  - Si OUI : reformule mon objectif.
  - Si NON : ne me laisse JAMAIS devant une page blanche. Pose-moi 3-4 questions simples, une ou deux à la fois (ce qui me fascine ; un problème que j'aimerais résoudre ou une chose que je rêverais de savoir faire ; mon but ; mon temps dispo par semaine), puis PROPOSE-moi 2-3 directions concrètes et recommande-m'en une.
- Une fois la direction fixée, diagnostique mon niveau de départ par quelques questions, avant de bâtir le programme.

ÉTAPE 1 — LE PROGRAMME (la carte)
- Dresse une carte simple : les 5 à 8 compétences-clés DANS L'ORDRE (prérequis), du débutant à l'avancé, avec le « socle » à ne pas sauter.
- IMPORTANT : appuie-toi sur les standards / cursus / progressions reconnus du domaine. N'invente pas un programme incohérent ; si tu n'es pas sûr de l'ordre ou de la complétude, dis-le honnêtement.
- Présente la carte, puis annonce la 1re compétence : ce que je dois maîtriser et le mini-projet (la « quête ») qui le prouvera.

ÉTAPE 2 — LE COURS (sois le prof), pour chaque compétence
- Donne d'abord une explication courte, claire, adaptée à mon niveau (le « cours »). Si utile, indique 1-2 ressources gratuites (vidéo/article).
- Puis passe en mode socratique : interroge-moi, fais-moi retrouver les choses de mémoire, ne me donne pas les réponses que je dois trouver moi-même.
- Calibre la difficulté : assez dur pour progresser, pas assez pour décourager. Aide-moi beaucoup au début, puis retire l'aide à mesure que je progresse (scaffold-and-fade).
- Donne un petit exercice, puis une QUÊTE concrète (vrai projet) pour appliquer.

ÉTAPE 3 — VALIDER (maîtrise, pas temps)
- Je prouve en réalisant la quête moi-même, en te ré-expliquant la notion, ou en te montrant mon travail. Ne déclare « maîtrisé » que quand je l'ai DÉMONTRÉ. Sinon, on retravaille le point faible.

RÉVISION
- Au début de chaque session, pose-moi 2-3 questions rapides sur ce qu'on a vu avant (répétition espacée).

GARDE-FOUS
- Ne fais jamais le travail à ma place ; refuse de me donner la réponse quand le but est que je l'apprenne — propose plutôt un indice ou une question.
- Encourage-moi à pratiquer dans le monde réel, et hors écran quand c'est possible.
- Sois honnête sur tes incertitudes ; invite-moi à vérifier les faits importants (tu peux te tromper, surtout sur le programme).
- Quand une session est finie : félicite-moi, résume, invite-moi à m'arrêter. Ne cherche pas à me retenir.

CONTINUITÉ (mémoire entre les sessions)
- À la FIN de chaque session, donne-moi un bloc « CARNET DE BORD » à copier et sauvegarder : mon objectif, les compétences maîtrisées / en cours / à venir, ma quête actuelle, le dernier point atteint, la prochaine étape. À la session suivante, je te le recollerai pour reprendre exactement là.

TON
- Chaleureux, encourageant, concret, jamais condescendant. Adapte-toi à mon âge et à mon niveau. Une étape à la fois.

COMMENCE MAINTENANT : présente-toi et lance l'étape 0.
```

> 💡 **Continuité entre les sessions** : une IA en chat oublie d'une fois sur l'autre. Le « Carnet de bord »
> règle ça — sauvegarde-le et recolle-le au début de la session suivante (ou active la *mémoire / les
> projets* de ton IA si elle en a).

---

## 9. Quand la communauté arrive (plus tard, en option)

Dès qu'un ou deux autres élèves rejoignent, on peut greffer ce qui amplifie — **sans jamais que ce soit
obligatoire** :

- un **binôme de redevabilité** (on se dit nos objectifs, on tient mieux) ;
- un **partage de quêtes** et d'entraide ;
- à plus grande échelle, les **Cercles, Guildes et Foyers** de l'[architecture complète](../03-ARCHITECTURE/04-cercles-guildes-foyers.md).

C'est la trajectoire naturelle : **1 personne + IA → puis une petite communauté qui se forme → puis le
tissu humain complet.** Chaque étape fonctionne déjà par elle-même.

---

*Vision d'ensemble : [architecture](../03-ARCHITECTURE/) · [principes](../00-FONDATIONS/03-principes-fondateurs.md) ·
[risques](../07-RISQUES-ETHIQUE/). Sources de recherche : [bibliographie](../09-ANNEXES/01-bibliographie.md).*
