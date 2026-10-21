# Conformité — à préparer avant diffusion

*Note rédigée le 8 septembre 2026. **Aucun code n'a été modifié** — ce
document sert à préparer une consultation juridique.*

> ⚠️ Les analyses ci-dessous viennent d'un assistant, pas d'un juriste.
> Elles servent à poser les bonnes questions, pas à y répondre.

---

## L'état actuel — ce qui joue en ta faveur

Vérifié dans le code au 8 septembre 2026 :

| Point | État |
|---|---|
| Serveur distant | **aucun** — tout reste sur l'appareil |
| Base locale | chiffrée |
| Verrouillage | code et empreinte disponibles (facultatifs) |
| Documents (ordonnances, photos) | **chiffrés** depuis le 9 sept. |
| Sauvegarde exportée | **en clair** ⚠️ |
| Fichier de synchronisation | **en clair** ⚠️ |

**Conséquence probable** : la certification HDS vise ceux qui hébergent
des données de santé *pour le compte d'un tiers*. JM@Santé n'héberge
rien — chaque infirmier reste responsable de ses propres données, comme
d'un classeur papier.

**À confirmer** : cette lecture tient-elle si l'app est diffusée
publiquement, même gratuitement ?

---

## Question 1 — Statut de dispositif médical

**C'est la question la plus structurante.** Elle détermine tout le reste :
marquage CE, organisme notifié, système de management de la qualité.

Le critère n'est ni la présence de données de santé, ni le fait que
l'utilisateur soit soignant. **C'est ce que le logiciel fait de la
donnée** : enregistrer et afficher reste hors du champ, interpréter ou
alerter y entre. Une source note qu'*un simple calcul de score peut
suffire à faire basculer un produit*.

### Les trois fonctions concernées

**1. Seuils d'alerte sur les constantes**
L'app signale une TA, une température, une saturation hors bornes. Les
seuils sont réglables par patient. Elle affiche un avertissement, ne
propose aucune conduite à tenir.

**2. Tendances (poids, tension)**
« Poids en baisse de 2,4 kg en 22 jours ». Détecte une dérive lente que
les seuils ne voient pas. Minimum 4 mesures sur 14 jours. Un encart
précise déjà : *« constat sur les mesures enregistrées — à interpréter
selon le contexte du patient »*.

**3 bis. Stade d'une plaie**
L'app enregistre le stade d'une escarre (1 à 4) sans en tirer aucune
conclusion : pas d'alerte, pas de « plaie qui se dégrade ». **Ce choix
est-il suffisant** pour rester hors du champ du dispositif médical, ou
le simple fait de stocker une évaluation clinique pose-t-il question ?

**3. Alerte de transit**
« 4 jours sans selle », seuil réglable par patient (défaut 3 jours). Un
jour non renseigné remet le compteur à zéro.

### À demander au juriste

- Ces trois fonctions font-elles basculer l'app en dispositif médical ?
- Un **avertissement explicite** (« ces seuils sont des repères, leur
  interprétation relève du professionnel ») change-t-il la
  qualification, ou seulement la démonstration d'intention ?
- Faudrait-il **retirer ou dégrader** ces fonctions pour rester hors du
  champ ? Par exemple : afficher les valeurs sans les qualifier
  d'« alerte ».

### Piste retenue en attendant

Ajouter un avertissement sur les trois fonctions, sur le modèle de celui
qui existe déjà pour les tendances. **Utile indépendamment du droit** :
un remplaçant qui découvre l'app doit comprendre qu'un seuil est un
repère, pas un verdict.

⚠️ Mais ne pas compter dessus pour trancher le statut — un avertissement
ne transforme pas une alerte en simple affichage.

---

## Question 2 — Droits du patient (RGPD)

### Ce qui a été envisagé, et pourquoi c'est probablement inadapté

Idée initiale : une **case d'accord signée par le patient**, avec
possibilité de rétractation.

**Réserve** : le soin infirmier repose vraisemblablement sur
l'**obligation légale** et l'**exécution du contrat de soins**, pas sur
le consentement. Le dossier patient est obligatoire.

Et un consentement rétractable créerait une contradiction : **si le
patient se rétracte, il faudrait effacer un dossier qu'on est tenu de
conserver.**

### Ce que le RGPD demande vraisemblablement

- **Informer** le patient du traitement de ses données
- Pouvoir lui **donner ses données** s'il les demande (droit d'accès)
- Un **registre des traitements** — même simplifié pour un libéral

### À demander au juriste

- Quelle base légale pour le dossier patient d'un IDEL libéral ?
- Le consentement est-il requis, ou l'information suffit-elle ?
- Quelle durée de conservation du dossier ? (l'app purge à 12 mois par
  défaut, réglable — est-ce conforme ?)
- Un registre des traitements est-il exigé, et sous quelle forme ?

### Piste retenue en attendant

**Export du dossier d'un patient** au format lisible, pour répondre à une
demande d'accès. Pas de case à cocher ni de signature.

---

## Question 3 — Le canal de transmission

**Le point le plus délicat.** Dès qu'une relève ou une note vocale quitte
l'appareil, des données de santé passent par un canal non maîtrisé.

Entre professionnels soumis au secret, dans le cadre de la prise en
charge d'un même patient, le partage est **légalement admis**. Mais le
canal compte.

**Constat de terrain** : tout le monde utilise WhatsApp pour la relève
orale, sans aucun garde-fou. L'app joint au moins une mention de secret
professionnel.

### À demander au juriste

- Une messagerie grand public est-elle acceptable entre soignants ?
- La mention jointe (« ne pas rediffuser, effacer après écoute ») a-t-elle
  une valeur ?
- Faudrait-il une messagerie sécurisée de santé (MSSanté) ?

---

## Les ajouts techniques à faire quoi qu'il arrive

Indépendants de la réponse juridique, utiles dans tous les cas :

1. **Politique de confidentialité** — écran dans l'app et page publique.
   Exigée par le magasin Google.
2. **Mention au premier lancement** avec acceptation explicite.
3. **Verrouillage imposé** plutôt que facultatif, sur un appareil
   contenant des dossiers patients.
4. **Sauvegarde et synchronisation chiffrées** — ces fichiers sont en clair
   et circulent par messagerie. C'est le point faible restant.
   *(Les documents dans l'app sont chiffrés depuis le 9 septembre.)*
5. **Export du dossier d'un patient** (droit d'accès).

---

## Sources consultées le 8 septembre 2026

- Agence du Numérique en Santé — certification HDS
- ANSM — logiciels et applications mobiles en santé, qualification DM
- Règlement (UE) 2017/745 relatif aux dispositifs médicaux

⚠️ Ces sources ont été lues rapidement et résumées. **Les vérifier**
avant de s'appuyer dessus.
