# Retirer les données patients de GitHub

*Note du 9 septembre 2026. Le dépôt doit rester accessible : des
collègues récupèrent l'app pour tester, notamment sur iPhone.*

---

## Le problème en deux lignes

15 jeux de test contenaient des **noms de patients réels**, leur adresse
et tes tournées. Ils ont été nettoyés dans la v1.0.10, mais **Git garde
tout l'historique** : ces noms restent lisibles dans les versions
précédentes du dépôt.

**Ce qui était exposé** : noms, prénoms, une adresse, noms de tournées.
**Ce qui ne l'était pas** : constantes, transmissions, documents,
dossiers complets.

---

## L'option retenue — repartir d'un dépôt propre

Puisque le dépôt doit rester public, la seule façon d'effacer
l'historique est d'en repartir. C'est simple et sans risque, à condition
de prévenir tes collègues.

### Ce que tu perds

L'historique des 90 versions sur GitHub. **Aucune importance ici** :
chaque livraison est archivée en ZIP sur ton disque et ton NAS, avec les
journaux. Rien n'est réellement perdu.

### Ce que tu gardes

Le code actuel, l'adresse du dépôt, l'accès de tes collègues.

---

## Procédure — environ 10 minutes

### 1. Prévenir tes collègues

Un message avant de commencer :

> *« Je remets le dépôt à zéro cet après-midi pour des raisons de
> confidentialité. L'adresse ne change pas. Si tu avais cloné le projet,
> il faudra le recloner après — je te préviens quand c'est fait. »*

### 2. Supprimer le dépôt sur GitHub

Sur **github.com/lez83/Jmasante** :

1. Onglet **Settings** (tout à droite du menu du dépôt)
2. Descendre tout en bas — zone **Danger Zone**
3. **Delete this repository**
4. GitHub demande de taper `lez83/Jmasante` pour confirmer

> ⚠️ C'est irréversible. Assure-toi d'avoir le ZIP de la v1.0.10 sur ton
> disque avant.

### 3. Recréer le dépôt

Toujours sur GitHub, bouton **New repository** :

- **Repository name** : `Jmasante` *(exactement le même nom)*
- **Public**
- **Ne coche rien** — ni README, ni .gitignore, ni licence
- **Create repository**

L'adresse reste `https://github.com/lez83/Jmasante.git`.

### 4. Pousser la version propre

Dans PowerShell, depuis le dossier de la v1.0.10 :

```powershell
cd "C:\Users\cavay\Desktop\Jm@sante\V87\JMSante_v1.0.10\JMSante"
```

**Supprimer l'ancien historique local** — sinon il repart avec :

```powershell
Remove-Item -Recurse -Force .git
```

Puis repartir de zéro :

```powershell
git init
git add .
git commit -m "v1.0.10"
git branch -M main
git remote add origin https://github.com/lez83/Jmasante.git
git push -u origin main
git tag v1.0.10
git push origin v1.0.10
```

### 5. Vérifier

Sur GitHub, l'onglet **Commits** ne doit montrer **qu'un seul commit**.
Utilise aussi la recherche du dépôt (barre en haut) pour vérifier que les
anciens noms ne ressortent plus.

### 6. Prévenir tes collègues

> *« C'est fait, l'adresse est la même. Si tu avais cloné, supprime ton
> dossier et reclone. »*

---

## Après cette opération

Les livraisons suivantes reprennent la séquence habituelle, **sans
`git init` ni `--force`** puisque le dépôt existe déjà :

```powershell
cd "C:\Users\cavay\Desktop\Jm@sante\V88\JMSante_v1.0.11\JMSante"
git init; git add .; git commit -m "v1.0.11 - description"
git branch -M main
git remote add origin https://github.com/lez83/Jmasante.git
git push -u origin main --force
git tag -f v1.0.11; git push -f origin v1.0.11
```

*(Cette séquence écrase à chaque fois, ce qui convient : chaque livraison
est un dossier neuf. L'historique GitHub restera court, ce qui n'est pas
un problème.)*

---

## Pour que ça ne se reproduise pas

Avant chaque envoi sur GitHub, une vérification :

```powershell
Select-String -Path "tests\_test_*.js","www\js\*.js" `
  -Pattern "ta liste de noms — à garder hors du dépôt" `
  -SimpleMatch:$false
```

**Aucun résultat = propre.** Si quelque chose ressort, dis-le-moi avant
de pousser.

⚠️ **Garde ta liste de noms sur un papier ou un fichier hors du projet.**
L'écrire dans un document du dépôt reviendrait à publier ce qu'on cherche
à retirer — l'erreur a été commise et corrigée le 9 septembre.

Cette vérification est aussi notée dans `tests/README_TESTS.md`.

---

## Une alternative si tu préfères ne rien supprimer

**Passer le dépôt en privé** et inviter tes collègues nommément :

1. **Settings** → **Danger Zone** → **Change repository visibility** →
   **Make private**
2. **Settings** → **Collaborators** → **Add people** → leur identifiant
   GitHub

Ils gardent l'accès, l'historique est conservé mais devient invisible au
public.

**Inconvénient** : chaque collègue doit avoir un compte GitHub et
accepter l'invitation. Plus lourd pour eux que de télécharger un ZIP
public.
