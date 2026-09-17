# Batterie de tests — mode d'emploi

*23 tests automatisés. Chacun charge l'application dans un navigateur
simulé, joue un scénario et vérifie le résultat.*

---

## Installer

```bash
cd tests
npm install jsdom fake-indexeddb
```

Les tests s'attendent à trouver l'application dans `../jmsante/www/`.
Adapte les chemins en tête de chaque fichier si ton arborescence diffère.

## Lancer

Un seul test :

```bash
node _test_selles.js
```

Toute la batterie :

```bash
for t in _test_*.js; do
  r=$(node "$t" 2>/dev/null | grep -cE "ERREURS: aucune|✓ SAUVÉ|✓ FONCTIONNE")
  echo "  $t : $([ $r -ge 1 ] && echo '✓' || echo '⚠')"
done
```

Un test réussi affiche `ERREURS: aucune` en dernière ligne.

---

## Ce que chacun vérifie

| Test | Ce qu'il protège |
|---|---|
| `_test_nonregression` | 45 points de contrôle sur l'ensemble de l'app |
| `_test_save` | L'écriture forcée quand l'app passe en arrière-plan |
| `_test_seq_save` | Un passage validé dans le déroulé est écrit immédiatement |
| `_test_seq_clic` | Le mode déroulé réserve la place sous la barre fixe |
| `_test_nav_all` | La barre de navigation sur les 43 feuilles |
| `_test_portable` | Une sauvegarde se restaure sur un autre appareil |
| `_test_vocal` | Notes vocales : limites, mention, ménage |
| `_test_selles` | Compteur de jours sans selle, seuil par patient |
| `_test_tendances` | Dérive du poids et de la TA que les seuils ne voient pas |
| `_test_suppr` | Retirer un soin du catalogue sans toucher l'historique |
| `_test_rappels` | Rappel fait qui devient une information de relève |
| `_test_traitement` | Fiche de traitement, détection des anticoagulants |
| `_test_finseq` | Écran de fin de tournée, passages modifiables |
| `_test_4points` | Types d'information, reprise au premier non vu |
| `_test_plancoche` | Plan de soins, cases cochées |
| `_test_dates` | Saisie différée, date de travail |
| `_test_journee` | Vue Journée, créneaux |
| `_test_menage` | Archivage et allègement de l'historique |
| `_test_dlu` | Dossier de liaison d'urgence |
| `_test_feuilles` | Feuilles à laisser au domicile |
| `_test_onglets` | Navigation dans la fiche patient |
| `_test_draft` | Brouillon de saisie conservé |
| `_test_gardefou` | Garde-fous du build |
| `_test_boutons` | Chaque bouton de la fiche a bien un gestionnaire |
| `_test_largeurs` | Les champs de l'annuaire ne tronquent pas leur contenu |
| `_test_docs` | Nomenclature : familles, nom composé, conversion PDF |
| `_test_docflow` | Les 4 sources d'ajout passent bien par la qualification |
| `_test_manuel` | Le sommaire du manuel se replie sur téléphone |
| `_test_anniv` | Fenêtre d'anniversaire, 29 février, passage d'année |
| `_test_chiffrdoc` | Les documents sont chiffrés, les anciens restent lisibles |
| `_test_grosdoc` | Chiffrement de documents jusqu'à 5 Mo sans casser la pile |
| `_test_chipsoin` | Tout soin créé reçoit crayon, appui long et commentaire |
| `_test_plaies` | Localisations, silhouettes, durées, relève sans jugement |
| `_test_navback` | Chaque écran câble son bouton « Annuler » (bindNav) |
| `_test_portee` | Aucun appel aux fonctions locales hors de leur portée |
| `_test_j1creneau` | J-1 reprend le bon créneau ; annulation dans le déroulé |
| `_test_recueil` | Fiche de recueil : regroupement, réécriture, visibilité |

---

## Les pièges qu'ils ont attrapés

Chacun de ces tests existe parce qu'un défaut réel est passé.

**`_test_seq_save`** — la validation dans le déroulé écrivait encore en
différé, une version après que le reste ait été corrigé. Une recherche par
motif l'avait manquée.

**`_test_seq_clic`** — le bouton Enregistrer passait sous la barre fixe :
visible, mais intapable. Aucun test de fonctionnement ne le voyait.

**`_test_selles`** — un jour non renseigné doit remettre le compteur à zéro.
Sans ça, l'app lèverait de fausses alertes sur des données absentes.

**`_test_suppr`** — retirer un soin du catalogue ne doit **jamais** toucher
l'historique. Le test vérifie qu'une visite garde son texte après suppression.

**`_test_boutons`** — un bouton posé dans le HTML sans gestionnaire ne fait rien
et ne lève aucune erreur. C'est arrivé au bouton « Fiche de recueil » : visible,
cliquable, muet. Le test compte les boutons branchés et signale les orphelins.

---

## Ce qu'ils ne voient pas

**Le rendu sur un vrai appareil.** Le libellé « Déroulé » s'affichait
parfaitement en test et restait invisible sur Android — le caractère `▶`
bascule en emoji et pousse le texte hors du bouton.

**Ce qui se passe dans le WebView.** `window.print()` n'y fonctionne pas,
alors qu'il marche dans tout navigateur.

**Les zones cliquables.** Un élément peut être visible et recouvert par un
autre. Pour ça, il faut demander au navigateur qui reçoit le clic à un
endroit donné.

Les captures d'écran d'un usage réel restent irremplaçables.


---

## ⚠️ Aucune donnée réelle dans les tests

Les jeux de test sont livrés dans le ZIP et poussés sur un dépôt **public**.
Ils ne doivent contenir que des noms manifestement fictifs — préfixe `Démo-`,
adresse « 1 rue de la Démonstration », téléphones à zéro.

⚠️ **Ne jamais écrire les vrais noms ici** : ce fichier est public lui aussi.
Garde ta liste de contrôle sur ton disque, pas dans le projet.

Vérification avant chaque livraison :

```bash
grep -riE "un nom de patient réel" _test_*.js   # garder la liste hors du dépôt
```
