# Mettre les tests en CI — à faire plus tard

*Laissé en suspens le 27 septembre 2026. Ce document dit quoi faire, pourquoi, et
où sont les pièges.*

---

## Ce que ça veut dire

Aujourd'hui les tests tournent **chez Claude**, avant chaque livraison. C'est ce qui permet
d'annoncer « 14 tests au vert » à chaque version.

Les mettre en CI, c'est les faire exécuter **par GitHub**, à chaque push, avant la compilation
de l'APK. Si un test échoue, la compilation s'arrête et aucun APK n'est produit.

**L'enjeu n'est pas la qualité du code — elle est déjà vérifiée. C'est l'autonomie :** le jour
où tu pousses sans passer par une séance — depuis Termux en tournée, ou après avoir retouché un
fichier toi-même — rien ne vérifie quoi que ce soit aujourd'hui. Tu découvrirais le problème sur
ton téléphone, chez un patient.

---

## Les trois obstacles

### 1. Les chemins codés en dur

Les 56 fichiers de test contiennent environ **130 chemins `../jmsante/…`** — le nom du dossier
de travail de Claude. Sur GitHub, le dépôt s'appelle `Jmasante`, et Linux distingue les
majuscules : ces chemins ne résoudront jamais.

**Correctif** : remplacer par un chemin calculé depuis l'emplacement du test.

```js
// En tête de chaque test, à la place de '../jmsante/www/js/…'
const path = require('path');
const RACINE = path.resolve(__dirname, '..');
const lire = f => require('fs').readFileSync(path.join(RACINE, f), 'utf-8');
// puis : lire('www/js/plaies.js')
```

Les tests vivant dans `tests/`, `__dirname/..` pointe sur la racine du dépôt — que le dossier
s'appelle `jmsante`, `JMSante` ou autrement.

### 2. Les échecs silencieux

**25 fichiers sur 56** sortent en code d'erreur ; les autres affichent un `⚠` puis se terminent
normalement. En CI, un test qui échoue sans code d'erreur est un test **vert**. Autant ne pas
en avoir.

**Correctif** : terminer chaque fichier par

```js
process.exit(ko.length ? 1 : 0);
```

où `ko` est la liste des contrôles ratés, déjà présente dans la plupart des tests.

### 3. Les attentes chronométrées

Plusieurs tests attendent une durée fixe — `setTimeout(…, 1500)` — pour laisser la page se
charger. Sur un serveur partagé, parfois lent, c'est un échec aléatoire.

**Correctif** : attendre une **condition**, pas une durée.

```js
await page.waitForFunction(() => typeof S !== 'undefined' && !!S);
```

⚠️ **Une CI qui crie à tort finit ignorée.** C'est le point à ne pas rater : mieux vaut trois
tests fiables que cinquante capricieux.

---

## L'étape dans le workflow

À insérer dans `.github/workflows/build-android.yml`, **avant** la compilation :

```yaml
      - name: Lancer les tests
        run: |
          npm ci || npm install
          cd tests
          npm install jsdom fake-indexeddb --no-save
          échecs=0
          for t in _test_*.js; do
            echo "── $t"
            node "$t" || échecs=$((échecs+1))
          done
          if [ "$échecs" -gt 0 ]; then
            echo "::error::$échecs test(s) en échec — APK non produit"
            exit 1
          fi
```

Certains tests utilisent Playwright, plus lourd à installer. Deux options : les séparer des
tests légers et ne lancer que ces derniers en CI, ou ajouter `npx playwright install --with-deps
chromium` — environ deux minutes de plus par compilation.

---

## Un ordre raisonnable

**D'abord les tests de fichiers** — ceux qui lisent le code et vérifient des motifs. Ils ne
demandent ni navigateur ni base de données, tournent en quelques secondes, et représentent la
majorité.

**Ensuite ceux qui montent un DOM** (jsdom, fake-indexeddb).

**Les tests Playwright en dernier**, ou jamais en CI : ils sont précieux en développement, mais
lourds et plus fragiles sur un serveur partagé.

---

## À corriger aussi

`tests/README_TESTS.md` annonçait **23 tests** alors qu'il y en a **56**. Corrigé le
27 septembre 2026. Un document qui décrit un état passé est plus dangereux qu'aucun document :
on s'y fie.
