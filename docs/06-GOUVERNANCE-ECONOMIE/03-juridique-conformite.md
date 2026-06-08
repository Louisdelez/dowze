# Juridique & conformité

> *Une infrastructure éducative mondiale traite des données sensibles de **mineurs** et utilise une IA que
> le droit européen classe « à haut risque ». La conformité n'est pas optionnelle : c'est une condition de
> survie (cf. l'effondrement d'AllHere/LAUSD).*

---

## Le cadre réglementaire applicable

| Réglementation | Portée | Exigence clé pour Dowze |
|----------------|--------|------------------------|
| **RGPD** (UE) | Données personnelles | Base légale, minimisation, droits (accès, effacement, portabilité), DPIA |
| **AI Act** (UE) | IA à haut risque | **Éducation = haut risque** : gestion des risques, qualité des données, documentation, **supervision humaine**, robustesse (obligations dès le **2 août 2026**) |
| **COPPA** (USA) | Enfants < 13 ans | Consentement parental vérifiable ; règles renforcées (conformité pleine **22 avril 2026**) |
| **FERPA** (USA) | Dossiers scolaires | Protection des dossiers éducatifs, contrôle parental/élève |
| **>121 lois d'État US** | Vie privée des élèves | Conformité locale au-delà de FERPA |

---

## La faille à ne pas reproduire

Une enquête CDT (2024) a révélé que **42 %** des districts scolaires utilisant des outils d'IA **n'avaient
pas signé d'accord de traitement des données** avec leurs fournisseurs, et **31 %** des administrateurs
**ignoraient quelle loi fédérale** régit ces données. Couplé à l'effondrement d'AllHere (chatbot « Ed » de
LAUSD) — où le **devenir des données élèves** est devenu une question ouverte à la faillite —, cela impose
des règles strictes.

---

## Les engagements de conformité de Dowze

### Vie privée par conception (principe 11)
- **Minimisation** : ne collecter que le strict nécessaire à l'apprentissage.
- **Données possédées par l'apprenant** : stockage de référence portable, contrôlé par la personne.
- **Zéro modèle publicitaire comportemental** ; zéro revente.
- **Chiffrement** au repos et en transit ; **journalisation** des accès.
- **Droits effectifs** : accès, rectification, effacement, portabilité.

### Protection spéciale des mineurs
- **Consentement parental vérifiable** pour les < 13 ans (COPPA).
- **Aucun profilage publicitaire** des enfants.
- **Garde-fous renforcés** sur le Mentor IA ; jamais de chatbot « compagnon »
  (voir [sécurité des mineurs](../07-RISQUES-ETHIQUE/03-securite-mineurs.md)).
- **Contrôles parentaux** et transparence.

### IA « haut risque » (AI Act)
- **DPIA / analyse d'impact** avant tout déploiement.
- **Documentation technique** et traçabilité des décisions.
- **Supervision humaine** (*human-in-the-loop*) sur les décisions à enjeu (orientation, évaluation à
  enjeu, détection de comportements).
- **Qualité et représentativité des données** d'entraînement ; **audits de biais** indépendants.
- **Robustesse et transparence** ; information claire de l'utilisateur qu'il interagit avec une IA.

---

## Souveraineté et fédération

La structure **fédérée** (voir [interopérabilité](../05-TECHNIQUE/06-interoperabilite-standards.md))
permet d'héberger les données **dans la juridiction de l'apprenant** — un atout majeur pour la conformité
RGPD (transferts de données) et la souveraineté nationale. Chaque instance régionale applique le droit
local tout en respectant le protocole commun.

---

## Gestion des fournisseurs (leçon LAUSD)

- **Accords de traitement des données signés et audités** avec tout sous-traitant (ne pas reproduire les
  42 % de districts sans accord).
- **Pas de dépendance à un fournisseur unique** : standards ouverts, plusieurs implémentations possibles.
- **Plan de continuité** : que deviennent les données si un prestataire disparaît ? Réponse : elles sont
  possédées par l'apprenant et hébergées par l'instance fédérée, pas par le prestataire.

---

## Propriété intellectuelle & contenus

- L'Atlas **pointe** vers des ressources existantes en respectant leurs licences (privilégier **OER** et
  **Creative Commons**).
- Les contributions à l'Atlas et aux Quêtes sont placées sous **licence ouverte** (le commun).
- Les **preuves** appartiennent à l'apprenant.

---

## La posture : la conformité comme avantage, pas comme contrainte

Beaucoup d'EdTech voient la régulation comme un frein. Dowze en fait un **atout de confiance** : une
infrastructure éducative *digne de confiance* est précisément celle qui respecte scrupuleusement la vie
privée et la sûreté. C'est ce qui la distingue des produits qui ont échoué pour avoir négligé ces enjeux.

**Renvois** : [sécurité des mineurs](../07-RISQUES-ETHIQUE/03-securite-mineurs.md) ·
[équité/biais](../07-RISQUES-ETHIQUE/04-equite-biais.md) · [gouvernance](01-gouvernance-commun.md).
